import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgModule, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc, where } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { ChannelsService } from '../../../shared/services/channels/channels.service';
import { MessagesService } from '../../../shared/services/messages/messages.service';
import { NoteService } from '../../../shared/services/notes/notes.service';
import { AuthService } from '../../../shared/services/authentication/auth-service/auth.service';
import { UserService } from '../../../shared/services/firestore/user-service/user.service';
import { User } from '../../../shared/models/user.class';
import { Channel } from '../../../shared/models/channel.class';
import { Message } from '../../../shared/models/message.class';
import { DirectMessage } from '../../../shared/models/direct.message.class';
import { ChatUtilityService } from '../../../shared/services/messages/chat-utility.service';
import { v4 as uuidv4 } from 'uuid';
import { EmojiReaction } from '../../../shared/models/emoji-reaction.model';
import { ChannelNavigationService } from '../../../shared/services/chat/channel-navigation.service';
import { DirectMessagesService } from '../../../shared/services/messages/direct-messages.service';
import { Note } from '../../../shared/models/note.class';
import { EmojiReactionService } from '../../../shared/services/chat/emoji-reaction.service';
import { MessageSearchService } from '../../../shared/services/chat/message-search.service';
import { ScrollManagementService } from '../../../shared/services/chat/scroll-management.service';

@Component({
  selector: 'app-direct-message',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, FormsModule,
    MatFormFieldModule, MatInputModule, CommonModule, PickerComponent, NgIf, NgFor,],
  templateUrl: './direct-message.component.html',
  styleUrls: ['./direct-message.component.scss',
    '../../../../styles.scss',
    '../../../shared/styles/message-editor.scss',
    '../../../shared/styles/message-textfield.scss',
    '../../../shared/styles/chat-window.scss'
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
})
export class DirectMessageComponent implements OnInit, AfterViewInit {
  message: DirectMessage[] = [];
  selectedMessage: DirectMessage | null = null;
  users: User[] = [];
  channels: Channel[] = [];
  currentUser: User | null | undefined = null;
  channelChatMessage = '';
  directChatMessage = '';
  messageArea = true;
  senderAvatar: string | null = null;
  senderName: string | null = null;
  messageId: string | null = null;

  @Output() openChannelEvent = new EventEmitter<void>();
  @Input() selectedUser = this.chatUtilityService.directMessageUser;
  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild('directChatMessageTextarea', { static: false }) directChatMessageTextarea!: ElementRef<HTMLTextAreaElement>;

  private isViewInitialized = false;

  constructor(
    public userService: UserService,
    private firestore: Firestore,
    private auth: Auth,
    private cd: ChangeDetectorRef,
    public authService: AuthService,
    public channelsService: ChannelsService,
    public dialog: MatDialog,
    public messagesService: MessagesService,
    private chatUtilityService: ChatUtilityService,
    private channelNavigationService: ChannelNavigationService,
    public noteService: NoteService,
    public directMessageService: DirectMessagesService,
    public emojiService: EmojiReactionService,
    public searchService: MessageSearchService,
    public scrollService: ScrollManagementService
  ) { }

  ngOnInit() {
    this.directMessageService.clearAndFocusTextarea.subscribe(() => {
      this.scrollService.clearAndFocusTextarea(this.directChatMessageTextarea, { set: (value) => this.directChatMessage = value });
      setTimeout(() => {
        this.scrollService.scrollToBottom(this.chatWindow);
      }, 0);
    });

    this.directMessageService.clickUserEvent.subscribe(() => {
      setTimeout(() => {
        this.scrollService.scrollToBottom(this.chatWindow);
      }, 50);
    });

    this.chatUtilityService.messageId$.subscribe(id => {
      this.messageId = id;
    });

    this.loadData();
    this.currentUser = this.authService.currentUser();

    setTimeout(() => {
      this.scrollService.scrollToBottom(this.chatWindow);
    }, 100);
  }

  ngAfterViewInit() {
    this.isViewInitialized = true;
    this.scrollService.clearAndFocusTextarea(this.directChatMessageTextarea, { set: (value) => this.directChatMessage = value });

    if (this.chatWindow) {
      this.scrollService.setupAutoScroll(this.chatWindow);
    }
  }

  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.loadUsers();
        await this.loadChannels();
      }
    });
  }

  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    onSnapshot(usersQuery, async (snapshot) => {
      this.users = await Promise.all(snapshot.docs.map(async (doc) => {
        let userData = doc.data() as User;
        return { ...userData, id: doc.id };
      }));
    });
  }

  async loadChannels() {
    let channelsRef = collection(this.firestore, 'channels');
    let channelsQuery = query(channelsRef, orderBy('name'));

    onSnapshot(channelsQuery, async (snapshot) => {
      this.channels = await Promise.all(snapshot.docs.map(async (doc) => {
        let channelsData = doc.data() as Channel;
        return { ...channelsData, id: doc.id };
      }));
    });
  }

  // Search methods using services
  updateSearchQuery(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.searchService.updateSearchQuery(target.value);
    this.searchService.performSearch(this.users, this.channels, this.currentUser?.id);
  }

  selectChannel(channel: Channel) {
    const result = this.searchService.selectChannel(channel, this.directChatMessage);
    this.directChatMessage = result.updatedMessage;
  }

  selectUser(user: User) {
    const result = this.searchService.selectUser(user, this.directChatMessage);
    this.directChatMessage = result.updatedMessage;
  }

  // Emoji methods using services
  showEmoji() {
    this.emojiService.toggleEmojiPicker();
  }

  showEmojiForEdit() {
    this.emojiService.toggleEmojiPickerEdit();
  }

  showEmojiForReact(message: any): void {
    this.scrollService.setPreventScroll(true);
    this.emojiService.toggleEmojiPickerReact(message);
  }

  addEmoji(event: any) {
    this.directChatMessage = this.emojiService.addEmojiToMessage(event, this.directChatMessage);
  }

  addEmojiForEdit(event: any) {
    this.directMessageService.editedMessage = this.emojiService.addEmojiToEdit(event, this.directMessageService.editedMessage);
  }

  addOrUpdateReaction(message: any, emoji: string): void {
    this.emojiService.addOrUpdateReaction(message, emoji, this.currentUser);
  }

  addEmojiForReact(event: any): void {
    this.emojiService.addEmojiReaction(event, this.currentUser);
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    this.emojiService.handleClickOutside(target);
  }

  // Message sending
  async sendDirectMessage() {
    if (this.directChatMessage.trim() && this.selectedUser) {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        const markedUserDetails = this.searchService.getMarkedUserDetails();

        const newDirectMessage: DirectMessage = new DirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          message: this.directChatMessage,
          receiverId: this.selectedUser.id,
          reactions: [],
          markedUser: markedUserDetails || [],
        });

        const directMessagesRef = collection(this.firestore, 'direct_messages');
        await addDoc(directMessagesRef, {
          senderId: newDirectMessage.senderId,
          senderName: newDirectMessage.senderName,
          message: newDirectMessage.message,
          receiverId: newDirectMessage.receiverId,
          reactions: newDirectMessage.reactions,
          timestamp: new Date(),
          markedUser: newDirectMessage.markedUser,
        });

        this.directChatMessage = '';
        this.searchService.clearMarkedItems();
      }
    }
  }

  // Legacy method alias for template compatibility
  sendMessage() {
    this.sendDirectMessage();
  }

  // Message editing methods
  showMessageEditToggle() {
    // Toggle edit mode - implement if needed
  }

  closeEditMessageBox() {
    // Close edit box - implement if needed
  }

  editMessage(messageId: string, messageText: string | null) {
    // Edit message - implement if needed
  }

  isEditing(messageId: string): boolean {
    // Check if message is being edited - implement if needed
    return false;
  }

  closeMessageEdit() {
    // Close message edit - implement if needed
  }

  saveEditedMessage(message: any) {
    // Save edited message - implement if needed
  }

  toggleSearch() {
    // Toggle search - could be removed or implemented
  }

  openUserInfoDialog(): void {
    if (this.userService.selectedUser) {
      this.userService.showUserInfo.set(true);
      this.userService.getSelectedUserById(this.userService.selectedUser.id);
    }
  }

  // Utility methods
  formatSenderNames(senderNames: string, senderIDs: string): string {
    const currentUserID = this.currentUser?.id;
    return this.emojiService.formatSenderNames(senderNames, senderIDs, currentUserID || '');
  }

  getReactionVerb(senderNames: string, senderIDs: string): string {
    const currentUserID = this.currentUser?.id;
    return this.emojiService.getReactionVerb(senderNames, senderIDs, currentUserID || '');
  }
}