import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { User } from '../../models/user.class';
import { Channel } from '../../models/channel.class';
import { UserService } from '../firestore/user-service/user.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from '@angular/fire/firestore';
import { ChannelsService } from '../channels/channels.service';
import { Message } from '../../models/message.class';
import { ChatUtilityService } from './chat-utility.service';

@Injectable({
  providedIn: 'root'
})
export class SendMessageService {
  users: User[] = [];
  channels: Channel[] = [];
  currentUser = this.authService.currentUser;
  showEmojiPicker = false;
  chatMessage = '';
  currentUserUid = this.currentUser()?.id;
  senderAvatar: string | null = null;
  senderName: string | null = null;
  selectedUser = this.userService.selectedUser;
  messageId: string | null = null;
  @ViewChild('chatWindow') private chatWindow!: ElementRef;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private channelsService: ChannelsService,
    private firestore: Firestore,
    private chatUtilityService: ChatUtilityService) {

    this.loadUsers();
  }


  async loadUsers() {
    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef, orderBy('name'));

    return new Promise((resolve) => {
      onSnapshot(usersQuery, async (snapshot) => {
        this.users = await Promise.all(snapshot.docs.map(async (doc) => {
          const userData = doc.data() as User;
          return { ...userData, id: doc.id };
        }));
        resolve(this.users); // Promise auflösen
      });
    });
  }


  async sendMessage() {
    if (this.chatMessage.trim()) {
      const currentUser = this.authService.currentUser;
      if (currentUser()) {
        if (this.channelsService.currentChannelId) {
          await this.sendChannelMessage(currentUser);
        }
        this.clearInputsAndScroll();
      } else {
        console.error('Kein Benutzer angemeldet');
      }
    }
  }


  async sendChannelMessage(currentUser: any) {
    const messagesRef = collection(this.firestore, 'messages');
    const newMessage: Message = new Message({
      senderID: currentUser()?.id,
      senderName: currentUser()?.name,
      message: this.chatMessage,
      channelId: this.channelsService.currentChannelId,
      reactions: [],
      answers: [],
    });

    const messageDocRef = await addDoc(messagesRef, {
      senderID: newMessage.senderID,
      senderName: newMessage.senderName,
      message: newMessage.message,
      channelId: newMessage.channelId,
      reactions: newMessage.reactions,
      answers: newMessage.answers,
      timestamp: new Date(),
    });
    this.handleChannelMessage();
  }


  handleDirectMessageUser() {
    if (this.selectedUser) {
      const userIndex = this.users.findIndex(user => user.id === this.selectedUser?.id);
      if (userIndex !== -1) {
        this.chatUtilityService.openDirectMessageFromChat(this.selectedUser, userIndex);
      } else {
        console.error("User not found in users array for ID:", this.selectedUser?.id);
      }
    } else {
      console.error("Selected user is null");
    }
  }


  handleChannelMessage() {
    const channelIndex = this.channelsService.channels.findIndex(channel => channel.id === this.channelsService.currentChannelId);
    if (channelIndex !== -1) {
      this.chatUtilityService.openChannelMessageFromChat(this.channelsService.channels[channelIndex], channelIndex);
    } else {
      console.error("Selected channel not found in channels array");
    }
  }


  clearInputsAndScroll() {
    this.chatMessage = '';
    this.scrollToBottom();
  }


  scrollToBottom(): void {
    if (this.chatWindow) {
      try {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      } catch (err) {
        console.error('Scroll to bottom failed:', err);
      }
    }
  }


  async getThreadsFromCurrentUser() {
    const q = query(collection(this.firestore, 'direct_messages'), where('senderID', '==', this.authService.currentUserUid));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (doc) => {
      const message = doc.data() as Message;
      this.updateSendernameOfThread(doc.id, this.authService.currentUser()?.name as string);
    });
  }


  updateSendernameOfThread(threadId: string, threadType: string) {
    const threadRef = doc(this.firestore, 'direct_messages', threadId);
    updateDoc(threadRef, { [(threadType)]: this.authService.currentUser()?.name });
  }
}