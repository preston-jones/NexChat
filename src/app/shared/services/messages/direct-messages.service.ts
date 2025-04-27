import { Injectable, EventEmitter, Output } from '@angular/core';
import { UserService } from '../firestore/user-service/user.service';
import { MessagesService } from './messages.service';
import { ChatUtilityService } from './chat-utility.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { User } from '../../models/user.class';
import { DirectMessage } from '../../models/direct.message.class';
import { Note } from '../../models/note.class';
import { NoteService } from '../notes/notes.service';
import { Firestore, collection, onSnapshot, query, orderBy, where, Timestamp, DocumentSnapshot, QuerySnapshot, DocumentData, doc, getDoc, getDocs, updateDoc, collectionData, docData } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class DirectMessagesService {
  clickUserEvent = new EventEmitter<void>();

  preventScroll = false;
  workspaceOpen: boolean = false;
  showDirectMessage: boolean = true;
  showChannelMessage: boolean = false;
  showChatWindow: boolean = true;
  showMessageEdit = false;
  showMessageEditArea = false;
  editedMessage = '';
  editingMessageId: string | null = null;
  directMessages: DirectMessage[] = [];
  currentConversation: DirectMessage[] = [];
  selectedUser: User | null = null;
  notes: Note[] = [];
  users: User[] = [];
  currentUserUid = this.authService.currentUser()?.id;

  @Output() clearAndFocusTextarea = new EventEmitter<void>();

  constructor(
    private firestore: Firestore,
    private userService: UserService,
    private messagesService: MessagesService,
    private chatUtilityService: ChatUtilityService,
    private authService: AuthService,
    private channelsService: ChannelsService,
    private noteService: NoteService
  ) { }


  openDirectMessage(selectedUserId: string | null | undefined) {
    let user = this.userService.users.find((user: User) => user.id === selectedUserId);
    let index = this.userService.users.findIndex((user: User) => user.id === selectedUserId);
    this.clickUserContainer(user!, index);
  }


  triggerClearAndFocus() {
    this.clearAndFocusTextarea.emit();
  }


  resetSrollPrevent() {
    console.log('resetSrollPrevent DIRECT', this.preventScroll);
    
    this.preventScroll = false;
  }


  clickUserContainer(clickedUser: User, i: number) {
    this.resetSrollPrevent();
    this.triggerClearAndFocus();
    this.selectedUser = clickedUser;
    this.userService.selectedUser = clickedUser;
    this.userService.selectedUserId = clickedUser.id;
    this.userService.clickedUsers.fill(false);
    this.channelsService.clickedChannels.fill(false);
    this.userService.clickedUsers[i] = true;
    this.clickUserEvent.emit();

    if (this.authService.currentUserUid) {
      if (clickedUser.id === this.authService.currentUserUid) {
        this.currentConversation = [];
        this.noteService.loadNotes();
      }
      else {
        this.loadCurrentConversation(clickedUser);
        this.chatUtilityService.setMessageId(null);
        // this.setAllMessagesAsRead();
      }
    }
  }


  orderedDirectMessages(directMessages: DirectMessage[]) {
    return directMessages.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  }


  async loadCurrentConversation(targetUser: User | null | undefined) {
    this.currentConversation = [];
    if (targetUser?.id) {
      // Lade den Benutzer basierend auf der targetUserId und setze selectedUser
      // this.chatUtilityService.directMessageUser = await this.loadSelectedUser(targetUserId);
      const selectedMessages = this.directMessages
        .filter(m => m.senderId === targetUser?.id || m.receiverId === targetUser?.id)
        .map(m => {
          m.isOwnMessage = m.senderId === this.authService.currentUserUid; // Recalculate isOwnMessage
          m.senderAvatar = targetUser?.avatarPath;
          m.displayDate = this.messagesService.formatTimestamp(m.timestamp.toDate());
          m.formattedTimestamp = m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return m;
        });
      this.currentConversation = selectedMessages;
    }
  }


  setMessageDisplayDate(msg: DirectMessage | Note) {
    let lastDisplayedDate: string | null = null;

    const messageDate = msg.timestamp.toDate();
    const formattedDate = this.messagesService.formatTimestamp(messageDate);

    // Setze das Anzeigen-Datum
    if (formattedDate !== lastDisplayedDate) {
      msg.displayDate = formattedDate;
      lastDisplayedDate = formattedDate;
    } else {
      msg.displayDate = null;
    }

    // Setze formattedTimestamp für die Nachricht
    msg.formattedTimestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }


  getUserName(user: User) {
    this.chatUtilityService.directMessageUser = user;
  }


  private async loadSelectedUser(targetUserId: string) {
    return await this.userService.getSelectedUserById(targetUserId);
  }


  async loadDirectMessages(): Promise<void> {
    const directMessagesRef = collection(this.firestore, 'direct_messages');
    const directMessagesQuery = query(directMessagesRef, orderBy('timestamp'));

    onSnapshot(directMessagesQuery, async (snapshot) => {
      // Verarbeite die geladenen Nachrichten
      this.directMessages = snapshot.docs
        .map(doc => {
          const directMessageData = doc.data() as DirectMessage;
          return {
            ...directMessageData,
            messageId: doc.id,
            timestamp: directMessageData.timestamp || new Date(), // Ensure timestamp is set
          };
        })
        .filter(directMessage =>
          directMessage.receiverId === this.authService.currentUserUid || directMessage.senderId === this.authService.currentUserUid
        );
      this.directMessages.forEach(async msg => {
        msg.isOwnMessage = (msg.senderId === this.authService.currentUserUid);
        this.setMessageDisplayDate(msg);
        // await this.loadSenderAvatar(msg);
      });
      console.log('Real-time Direct Messages:', this.directMessages);
      await this.loadCurrentConversation(this.selectedUser);
    });
  }



  formatTimestamp(directMessageDate: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = directMessageDate.toDateString() === today.toDateString();
    const isYesterday = directMessageDate.toDateString() === yesterday.toDateString();

    if (isToday) {
      return 'Heute'; // Wenn die Nachricht von heute ist
    } else if (isYesterday) {
      return 'Gestern'; // Wenn die Nachricht von gestern ist
    } else {
      // Format "13. September"
      return directMessageDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    }
  }


  saveMessage(message: DirectMessage, editingMessageId: string, editedMessage: string) {
    if (message && editingMessageId) {
      const messageRef = doc(this.firestore, `direct_messages/${editingMessageId}`);
      updateDoc(messageRef, { message: editedMessage });
    }
  }
}