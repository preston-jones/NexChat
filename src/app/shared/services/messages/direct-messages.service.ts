import { Injectable, EventEmitter, Output } from '@angular/core';
import { UserService } from '../firestore/user-service/user.service';
import { MessagesService } from './messages.service';
import { ChatUtilityService } from './chat-utility.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { User } from '../../models/user.class';
import { DirectMessage } from '../../models/direct.message.class';
import { Note } from '../../models/note.class';
import { Firestore, collection, onSnapshot, query, orderBy, where, Timestamp, DocumentSnapshot, QuerySnapshot, DocumentData, doc, getDoc, getDocs, updateDoc, collectionData, docData } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class DirectMessagesService {
  clickUserEvent = new EventEmitter<void>();

  workspaceOpen: boolean = false;
  showDirectMessage: boolean = true;
  showChannelMessage: boolean = false;
  showChatWindow: boolean = false;
  directMessages: DirectMessage[] = [];
  currentConversation: DirectMessage[] = [];
  notes: Note[] = [];
  users: User[] = [];
  currentUserUid = this.authService.currentUser()?.id;


  constructor(
    private firestore: Firestore,
    private userService: UserService,
    private messagesService: MessagesService,
    private chatUtilityService: ChatUtilityService,
    private authService: AuthService,
    private channelsService: ChannelsService,
  ) { }


  ngOnInit() {
    this.loadDirectMessagesAsPromise();
  }


  openDirectMessage(selectedUserId: string | null | undefined) {
    let user = this.userService.users.find((user: User) => user.id === selectedUserId);
    let index = this.userService.users.findIndex((user: User) => user.id === selectedUserId);
    this.clickUserContainer(user!, index);
  }


  clickUserContainer(clickedUser: User, i: number) {
    this.currentConversation = [];
    this.userService.clickedUsers.fill(false);
    this.channelsService.clickedChannels.fill(false);
    this.userService.clickedUsers[i] = true;
    this.getUserName(clickedUser);
    this.clickUserEvent.emit();
    console.log('User clicked:', clickedUser);

    if (this.authService.currentUserUid) {
      if (clickedUser.id === this.authService.currentUserUid) {
        this.loadNotes();
        console.log('Load Notes.');
      }
      else {
        this.loadCurrentConversation(clickedUser.id).then(() => {
          this.currentConversation = this.directMessages.filter(m => m.senderId === clickedUser.id || m.receiverId === clickedUser.id);
          this.chatUtilityService.setMessageId(null);
          // this.setAllMessagesAsRead();
          console.log('Current Conversation:', this.currentConversation);
        });
      }
    }
  }


  orderedDirectMessages(directMessages: DirectMessage[]) {
    return directMessages.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  }


  async loadCurrentConversation(targetUserId: string | null | undefined) {
    if (targetUserId) {
      // Lade den Benutzer basierend auf der targetUserId und setze selectedUser
      this.chatUtilityService.directMessageUser = await this.loadSelectedUser(targetUserId);
    }
    const selectedMessages = this.directMessages.filter(m => m.senderId === targetUserId || m.receiverId === targetUserId);
    selectedMessages.forEach(async msg => {
      msg.isOwnMessage = (msg.senderId === this.authService.currentUserUid);
      await this.processConversation(selectedMessages);
    });
    this.currentConversation = selectedMessages;
  }


  async loadNotes() {
    this.notes = [];
    this.notes.forEach(async note => {
      this.setMessageDisplayDate(note);
    });
  }


  // async loadDirectMessagesAsPromise(): Promise<DirectMessage[]> {
  //   let directMessagesRef = collection(this.firestore, 'direct_messages');
  //   let directMessagesQuery = query(directMessagesRef, orderBy('timestamp'));
  //   const querySnapshot = await getDocs(directMessagesQuery);

  //   this.directMessages = querySnapshot.docs
  //     .map(doc => {
  //       let directMessageData = doc.data() as DirectMessage;
  //       return { ...directMessageData, messageId: doc.id, timestamp: directMessageData.timestamp || new Date() };
  //     })
  //     .filter(directMessage =>
  //       directMessage.receiverId === this.authService.currentUserUid || directMessage.senderId === this.authService.currentUserUid
  //     );
  //   this.orderedDirectMessages(this.directMessages);
  //   console.log('onInit || Users Direct Messages:', this.directMessages);

  //   return this.directMessages;
  // }


  async loadDirectMessagesAsPromise(): Promise<void> {
    const directMessagesRef = collection(this.firestore, 'direct_messages');
    const directMessagesQuery = query(directMessagesRef, orderBy('timestamp'));
  
    // Set up a real-time listener with onSnapshot
    onSnapshot(directMessagesQuery, (querySnapshot) => {
      this.directMessages = querySnapshot.docs
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
  
      // Order the messages after fetching
      this.orderedDirectMessages(this.directMessages);
  
      // Log the updated messages
      console.log('Real-time Direct Messages:', this.directMessages);
    }, (error) => {
      console.error('Error listening to direct messages:', error);
    });
  }


  private async processConversation(conversation: DirectMessage[]) {
    await Promise.all(conversation.map(async (msg: DirectMessage) => {
      await this.loadSenderAvatar(msg);
      this.setMessageDisplayDate(msg);
    }));
  }


  private async loadSenderAvatar(msg: DirectMessage) {
    if (msg.senderId) {
      const senderUser = await this.userService.getSelectedUserById(msg.senderId);
      msg.senderAvatar = senderUser?.avatarPath || './assets/images/avatars/avatar5.svg';
    } else {
      msg.senderAvatar = './assets/images/avatars/avatar5.svg';
      console.log("Sender ID is undefined for message:", msg);
    }
  }

  private setMessageDisplayDate(msg: DirectMessage | Note) {
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


  // listenToCurrentConversation(selectedUserId: string) {
  //   const messagesRef = collection(this.firestore, 'direct_messages');
  //   const q = query(
  //     messagesRef,
  //     where('senderId', 'in', [this.authService.currentUserUid, selectedUserId]),
  //     where('receiverId', 'in', [this.authService.currentUserUid, selectedUserId]),
  //     orderBy('timestamp', 'asc')
  //   );
  
  //   onSnapshot(q, (snapshot) => {
  //     this.currentConversation = snapshot.docs.map(doc => doc.data() as DirectMessage);
  //     this.cd.detectChanges(); // Trigger change detection to update the UI
  //   });
  // }


  /* Noch zu erledigen  !!!


  async setAllMessagesAsRead(): Promise<void> {
    try {
      // Referenz zur gesamten Sammlung `direct_messages`
      const messagesCollectionRef = collection(this.firestore, 'direct_messages');

      // Abrufen aller Dokumente innerhalb der Sammlung
      const querySnapshot = await getDocs(messagesCollectionRef);

      // Durchlaufe jedes Dokument in der Sammlung
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const conversations = data['conversation'] || [];

        // Aktualisiere nur die Konversationen, bei denen `receiverId` der aktuelle Benutzer ist
        let updatedConversations = conversations.map((conv: any) => {

          if (conv.receiverId === this.authService.currentUserUid && !conv.readedMessage) {
            return { ...conv, readedMessage: true };
          }
          return conv;
        });


        // Überschreibe das Dokument mit den aktualisierten Konversationen
        await updateDoc(doc.ref, { conversation: updatedConversations });
        // this.listenToConversations();
      }

      // console.log('Alle Nachrichten wurden als gelesen markiert.');
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Nachrichten:', error);
    }
  }


  async listenToConversations(): Promise<void> {
    try {
      // Referenz zur gesamten Sammlung `direct_messages`
      const messagesCollectionRef = collection(this.firestore, 'direct_messages');

      // Filtere die Konversationen, bei denen der aktuelle Benutzer der Empfänger ist
      const q = query(
        messagesCollectionRef,
        where('receiverId', '==', this.authService.currentUserUid) // nur Konversationen des aktuellen Benutzers
      );

      // Listener für Echtzeit-Updates
      onSnapshot(q, (querySnapshot) => {
        // Mapping der ungelesenen Nachrichten pro Sender
        const unreadMessagesBySender: { [key: string]: number } = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const conversations = data['conversation'] || [];

          // Filtere ungelesene Nachrichten
          const userConversations = conversations.filter((conv: any) =>
            conv.receiverId === this.currentUserUid && !conv.readedMessage
          );

          // Zähle ungelesene Nachrichten für jeden Sender
          userConversations.forEach((msg: any) => {
            if (!unreadMessagesBySender[msg.senderId]) {
              unreadMessagesBySender[msg.senderId] = 0;
            }
            unreadMessagesBySender[msg.senderId]++;
          });
        });

        // Aktualisiere die Benutzerliste mit der Anzahl ungelesener Nachrichten
        this.users = this.users.map((user) => {
          return {
            ...user,
            unreadMessagesCount: unreadMessagesBySender[user.id] || 0, // Standardwert: 0
          };
        });

        // console.log('Ungelesene Nachrichten pro Sender:', unreadMessagesBySender);
      });
    } catch (error) {
      console.error('Fehler beim Überwachen der Konversationen:', error);
    }
  }
    */
}