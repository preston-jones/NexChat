import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnInit, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Message } from '../../shared/models/message.class';
import { User } from '../../shared/models/user.class';
import { collection, doc, Firestore, onSnapshot, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { UploadFileService } from '../../shared/services/firestore/storage-service/upload-file.service';
import { arrayUnion, getDoc, getDocs } from 'firebase/firestore';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { Channel } from '../../shared/models/channel.class';
import { SendMessageService } from '../../shared/services/messages/send-message.service';
import { ThreadMessagesComponent } from './thread-messages/thread-messages.component';

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    PickerComponent,
    NgIf,
    NgFor,
    ThreadMessagesComponent
  ],
  templateUrl: './thread.component.html',
  styleUrls: [
    './thread.component.scss',
    '../../../styles.scss',
    '../../shared/styles/message-editor.scss',
    '../../shared/styles/message-textfield.scss',
    '../../shared/styles/chat-window.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})

export class ThreadComponent implements OnInit {
  @Output() closeThreadEvent = new EventEmitter<void>();
  @Input() selectedMessage: Message | null = null;

  messages: Message[] = [];
  users: User[] = [];
  channels: Channel[] = [];
  currentUser = this.authService.getUserSignal();
  currentUserUid: string | null = null;
  showEmojiPicker = false;
  typedMessage = '';
  senderAvatar: string | null = null;
  senderName: string | null = null;
  selectedFile: File | null = null;
  filePreviewUrl: string | null = null;
  selectedMessageId: string | null = null;
  showUserList = false;

  constructor(private firestore: Firestore, private auth: Auth, private userService: UserService, private cd: ChangeDetectorRef, private authService: AuthService, private uploadFileService: UploadFileService, public channelsService: ChannelsService, public sendMessageService: SendMessageService) { }

  ngOnInit() {
    this.getCurrentUser();
    this.loadMessages();
    this.loadAllUsers()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedMessage'] && this.selectedMessage) {
      this.loadMessages();
    }
  }

  closeThread() {
    this.closeThreadEvent.emit();
  }

  async getCurrentUser() {
    while (this.authService.currentUser() === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Kurz warten
    }
    const userId = this.currentUser()?.id;
    if (userId) {
      this.currentUserUid = userId;
      this.loadUserData(this.currentUserUid);
    }
  }

  loadUserData(uid: string | null) {
    if (!uid) return;
    const userDocRef = doc(this.firestore, `users/${uid}`);
    onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as { name: string; avatarPath: string; };
        this.senderName = data.name;
        this.senderAvatar = data.avatarPath;
      }
    });
  }

  async loadAllUsers() {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(usersCollectionRef);
      this.users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];

    } catch (error) {
      console.error('Fehler beim Laden der Benutzer:', error);
    }
  }

  toggleUserList() {
    this.showUserList = !this.showUserList;
  }

  markUser(userName: string) {
    this.typedMessage += `@${userName} `;
    this.showUserList = false;
  }

  async loadMessages() {
    if (!this.selectedMessage) {
      this.messages = [];
      return;
    }

    const messageRef = doc(this.firestore, 'messages', this.selectedMessage.messageId);
    const messageSnap = await getDoc(messageRef);

    if (messageSnap.exists()) {
      const selectedMessageData = messageSnap.data();
      const answers = selectedMessageData['answers'] || [];
      this.selectedMessage.isOwnMessage = this.selectedMessage.senderID === this.currentUserUid;

      this.messages = await Promise.all(
        answers.map((answer: any) => this.checkLoadMessagesDetails(answer))
      );

      this.cd.detectChanges();
    }
  }

  private async checkLoadMessagesDetails(answer: any): Promise<Message> {
    const message = new Message(answer, this.currentUserUid);

    if (message.senderID) {
      const senderUser = await this.userService.getSelectedUserById(message.senderID);
      message.senderAvatar = senderUser?.avatarPath || './assets/images/avatars/avatar5.svg';
    } else {
      message.senderAvatar = './assets/images/avatars/avatar5.svg';
    }

    const messageDate = new Date(answer.timestamp.seconds * 1000);
    message.formattedTimestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return message;
  }

  async sendMessage() {
    if (this.typedMessage.trim() || this.selectedFile) {
      const currentUser = this.authService.currentUser;

      if (currentUser()) {
        const newMessageId = doc(collection(this.firestore, 'messages')).id;
        const newMessage: Message = new Message({
          senderID: this.currentUserUid,
          senderName: this.senderName,
          message: this.typedMessage,
          reactions: [],
          parentMessageId: this.selectedMessage ? this.selectedMessage.messageId : null,
          fileURL: '',
          messageId: newMessageId
        });

        if (this.selectedMessage) {
          await this.uploadMessage(newMessage, this.selectedMessage);
        }

        await this.handleFileUpload(newMessage, newMessageId);

        this.typedMessage = '';
        this.selectedFile = null;
        this.loadMessages();
        // this.sendMessageService.scrollToBottom();
        this.sendMessageService.deleteUpload();
      } else {
        console.error('Kein Benutzer angemeldet');
      }
    }
  }

  private async handleFileUpload(newMessage: Message, newMessageId: string) {
    if (this.selectedFile && this.currentUserUid) {
      try {
        const fileURL = await this.uploadFileService.uploadFileWithIds(this.selectedFile, this.currentUserUid, newMessageId);
        newMessage.fileURL = fileURL;
        await updateDoc(doc(this.firestore, 'messages', newMessageId), { fileURL: newMessage.fileURL });
      } catch (error) {
        console.error('Datei-Upload fehlgeschlagen:', error);
      }
    }
  }

  async uploadMessage(message: Message, selectedMessage: Message) {
    const messageRef = doc(this.firestore, 'messages', selectedMessage.messageId);

    await updateDoc(messageRef, {
      answers: arrayUnion({
        senderID: message.senderID,
        senderName: message.senderName,
        message: message.message,
        timestamp: new Date(),
        reactions: message.reactions,
        messageId: message.messageId
      })
    });
  }

  showEmoji(messageId: string) {
    this.selectedMessageId = messageId;
    this.showEmojiPicker = true;
  }

  addEmoji(event: any): void {
    const emoji = event.emoji.native;
    this.typedMessage += emoji;
    this.showEmojiPicker = false;
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (this.showEmojiPicker) {
      if (!target.closest('.thread-message-icon')) {
        this.showEmojiPicker = false;
      }
    }
  }
}