import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild, ViewContainerRef, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { addDoc, collection, doc, Firestore, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { User } from '../../../shared/models/user.class';
import { Channel } from '../../../shared/models/channel.class';
import { UserService } from '../../../shared/services/firestore/user-service/user.service';
import { AuthService } from '../../../shared/services/authentication/auth-service/auth.service';
import { ChannelsService } from '../../../shared/services/channels/channels.service';
import { MessagesService } from '../../../shared/services/messages/messages.service';
import { ChannelDescriptionDialogComponent } from '../../../dialogs/channel-description-dialog/channel-description-dialog.component';
import { Message } from '../../../shared/models/message.class';
import { ChannelNavigationService } from '../../../shared/services/chat/channel-navigation.service';
import { ChatUtilityService } from '../../../shared/services/messages/chat-utility.service';
import { WelcomePageComponent } from '../../../shared/templates/welcome-page/welcome-page.component';
import { EmojiReaction } from '../../../shared/models/emoji-reaction.model';
import { EmojiReactionService } from '../../../shared/services/chat/emoji-reaction.service';
import { MessageSearchService } from '../../../shared/services/chat/message-search.service';
import { ScrollManagementService } from '../../../shared/services/chat/scroll-management.service';



@Component({
  selector: 'app-channel-message',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, FormsModule,
    MatFormFieldModule, MatInputModule, CommonModule, PickerComponent, NgIf, NgFor, WelcomePageComponent],
  templateUrl: './channel-message.component.html',
  styleUrls: [
    './channel-message.component.scss',
    '../../../../styles.scss',
    '../../../shared/styles/message-editor.scss',
    '../../../shared/styles/message-textfield.scss',
    '../../../shared/styles/chat-window.scss'
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
})
export class ChannelMessageComponent implements OnInit, AfterViewInit, OnDestroy {
  messages: Message[] = [];
  selectedMessage: Message | null = null;
  users: User[] = [];
  channels: Channel[] = [];
  currentUser = this.authService.currentUser;
  channelChatMessage = '';
  messageArea = true;
  editedMessage: string = '';
  currentUserUid = '';
  editingMessageId: string | null = null;
  senderAvatar: string | null = null;
  senderName: string | null = null;
  showMessageEdit = false;
  showMessageEditArea = false;
  private isViewInitialized = false;
  private isDestroyed = false;

  @Output() showThreadEvent = new EventEmitter<Message>();
  @Output() openChannelEvent = new EventEmitter<void>();
  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild('chatMessageTextarea', { static: false }) chatMessageTextarea!: ElementRef<HTMLTextAreaElement>;

  constructor(private firestore: Firestore, private auth: Auth,
    public userService: UserService, private cd: ChangeDetectorRef,
    private authService: AuthService,
    public channelsService: ChannelsService, public dialog: MatDialog,
    public messageService: MessagesService, private channelNavigationService: ChannelNavigationService, 
    private chatUtilityService: ChatUtilityService,
    public emojiService: EmojiReactionService,
    public searchService: MessageSearchService,
    public scrollService: ScrollManagementService) { }


  ngOnInit() {
    this.channelsService.clearAndFocusTextarea.subscribe(() => {
      this.scrollService.clearAndFocusTextarea(this.chatMessageTextarea, { set: (value) => this.channelChatMessage = value });
      setTimeout(() => {
        this.scrollService.scrollToBottom(this.chatWindow);
      }, 0);
    });

    this.channelsService.clickUserEvent.subscribe(() => {
      setTimeout(() => {
        this.scrollService.scrollToBottom(this.chatWindow);
      }, 50);
    });

    this.loadData();
    
    setTimeout(() => {
      this.scrollService.scrollToBottom(this.chatWindow);
    }, 100);
  }


  ngAfterViewInit() {
    this.isViewInitialized = true;
    this.cd.detectChanges();
    
    setTimeout(() => {
      this.scrollService.clearAndFocusTextarea(this.chatMessageTextarea, { set: (value) => this.channelChatMessage = value });
    }, 0);
    
    setTimeout(() => {
      if (this.messageService.scrollToMessageId) {
        this.scrollService.scrollToMessage(this.chatWindow);
      } else {
        this.scrollService.scrollToBottom(this.chatWindow);
      }
    }, 0);
    
    if (this.chatWindow) {
      this.scrollService.setupAutoScroll(this.chatWindow);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
  }


  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.loadUsers();
        this.channelsService.loadChannels();
      } else {
      }
    });
  }


  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));
    let allUsers:any = [];

    onSnapshot(usersQuery, async (snapshot) => {
      this.users = await Promise.all(snapshot.docs.map(async (doc) => {
        let userData = doc.data() as User;
        allUsers.push(userData);

        return { ...userData, id: doc.id };
      }));

    });
  }

  scrollToBottom() {
    if (this.channelsService.preventScroll) {
      this.channelsService.preventScroll = false; // Reset the flag
      return; // Prevent scrolling
    }
    
    if (this.chatWindow && this.chatWindow.nativeElement) {
      try {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      } catch (error) {
        console.warn('Could not scroll to bottom:', error);
        // Retry after a short delay if element is not ready
        setTimeout(() => {
          if (this.chatWindow && this.chatWindow.nativeElement) {
            this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
          }
        }, 100);
      }
    } else {
      console.warn('ChatWindow not available for scrolling');
    }
  }

  toggleSearch(): void {
    // This method can be removed as search is now handled by the service
    // keeping for backward compatibility if needed
  }

  updateSearchQuery(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.searchService.updateSearchQuery(target.value);
    this.searchService.performSearch(this.users, this.channels, this.authService.currentUserUid);
  }

  selectChannel(channel: Channel) {
    const result = this.searchService.selectChannel(channel, this.channelChatMessage);
    this.channelChatMessage = result.updatedMessage;
  }

  async openChanneFromDirectMessage(channel: Channel, i: number) {
    const currentUser = this.currentUser();
    this.searchService.resetSearch();
    this.channelChatMessage = '';
    this.channelsService.currentChannelId = channel.id;
    this.channelsService.channelIsClicked = true;
    this.channelsService.clickChannelContainer(channel, i);
    this.openChannelEvent.emit();
    this.chatUtilityService.openChannelMessage();
    if (currentUser) {
      this.messageService.loadMessages(currentUser.id, channel.id);
    } else {
      console.error("currentUserUid is null");
    }
    this.channelsService.loadChannels();
  }

  selectUser(user: User) {
    const result = this.searchService.selectUser(user, this.channelChatMessage);
    this.channelChatMessage = result.updatedMessage;
  }

  onSearch(): void {
    this.searchService.performSearch(this.users, this.channels, this.authService.currentUserUid);
  }



  openChannelDescriptionDialog() {
    this.dialog.open(ChannelDescriptionDialogComponent)
  }

  showEmoji() {
    this.emojiService.toggleEmojiPicker();
  }

  showEmojiForEdit() {
    this.emojiService.toggleEmojiPickerEdit();
  }

  showEmojiForReact(message: Message) {
    this.scrollService.setPreventScroll(true);
    this.emojiService.toggleEmojiPickerReact(message);
  }

  addEmoji(event: any) {
    this.channelChatMessage = this.emojiService.addEmojiToMessage(event, this.channelChatMessage);
  }

  addEmojiForEdit(event: any) {
    this.editedMessage = this.emojiService.addEmojiToEdit(event, this.editedMessage);
  }

  addOrUpdateReaction(message: any, emoji: string): void {
    const currentUser = this.currentUser();
    this.emojiService.addOrUpdateReaction(message, emoji, currentUser);
  }

  async updateMessageReactions(message: any): Promise<void> {
    // This is now handled by the emoji service
  }

  addEmojiForReact(event: any): void {
    this.emojiService.addEmojiReaction(event, this.currentUser());
  }

  toggleEmojiPicker() {
    this.emojiService.toggleEmojiPicker();
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    this.emojiService.handleClickOutside(target);
  }

  // --------------------------


  showMessageEditToggle() {
    this.showMessageEdit = !this.showMessageEdit;
  }

  closeEditMessageBox() {
    this.channelsService.preventScroll = true; // Erlaube das Scrollen wieder
    this.showMessageEdit = false;
  }

  editMessage(docId: string, messageText: string | null) {
    this.editingMessageId = docId; // Verwende die Dokument-ID
    this.editedMessage = messageText || '';
    this.showMessageEditArea = true;
    this.showMessageEdit = false;
  }


  saveMessage(message: Message) {
    if (this.editingMessageId) { // Nutze die `editingMessageId` (Dokument-ID) anstelle von `message.messageId`
      const messageRef = doc(this.firestore, `messages/${this.editingMessageId}`); // Verweise auf die Dokument-ID

      updateDoc(messageRef, { message: this.editedMessage }).then(() => {
        this.editingMessageId = null;
        this.showMessageEditArea = false;
      }).catch(error => {
        console.error("Fehler beim Speichern der Nachricht: ", error);
      });
    }
  }

  cancelMessageEdit() {
    this.editingMessageId = null;
    this.editedMessage = '';
    this.showMessageEditArea = false;
  }

  isEditing(docId: string): boolean {
    return this.editingMessageId === docId; // Prüfe gegen die Firestore-Dokument-ID
  }

  async showThread(message: Message) {
    this.messageService.selectedMessage = message;
    for (const answer of message.answers) {
      answer.isOwnMessage = (answer.senderID === this.authService.currentUserUid);
      answer.displayDate = this.messageService.formatTimestamp(answer.timestamp.toDate());
      answer.formattedTimestamp = answer.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      answer.senderAvatar = await this.userService.getSelectedUserAvatar(answer.senderID!);
    }

    this.selectedMessage = message;
    this.showThreadEvent.emit(message); // Emit the updated message
  }


  showError() {
    console.error("Kein Kanal ausgewählt.");
  }

  async sendMessage() {
    if (!this.channelsService.currentChannelId) {
      this.showError();
      return;
    }

    if (this.channelChatMessage.trim()) {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        const messagesRef = collection(this.firestore, 'messages');

        const markedUserDetails = this.searchService.getMarkedUserDetails();

        const newMessage: Message = new Message({
          senderID: this.currentUser()?.id,
          senderName: this.currentUser()?.name,
          message: this.channelChatMessage,
          channelId: this.channelsService.currentChannelId,
          reactions: [],
          answers: [],
          markedUser: markedUserDetails || [],
        });

        const messageDocRef = await addDoc(messagesRef, {
          senderID: newMessage.senderID,
          senderName: newMessage.senderName,
          message: newMessage.message,
          channelId: newMessage.channelId,
          reaction: newMessage.reactions,
          answers: newMessage.answers,
          timestamp: new Date(),
          markedUser: newMessage.markedUser,
        });

        this.channelChatMessage = '';
        this.searchService.clearMarkedItems();
        this.messageService.loadMessages(this.authService.currentUser()?.id, this.channelsService.currentChannelId);
      } else {
        console.error('Kein Benutzer angemeldet');
      }
    }
  }

  formatSenderNames(senderNames: string, senderIDs: string): string {
    const currentUserID = this.currentUser()?.id;
    return this.emojiService.formatSenderNames(senderNames, senderIDs, currentUserID || '');
  }

  getReactionVerb(senderNames: string, senderIDs: string): string {
    const currentUserID = this.currentUser()?.id;
    return this.emojiService.getReactionVerb(senderNames, senderIDs, currentUserID || '');
  }
}