import { Injectable, EventEmitter, Output } from '@angular/core';
import { UserService } from '../firestore/user-service/user.service';
import { MessagesService } from './messages.service';
import { ChatUtilityService } from './chat-utility.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { User } from '../../models/user.class';
import { DirectMessage } from '../../models/direct.message.class';
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


  openDirectMessage(selectedUserId: string | null | undefined) {
    let user = this.userService.users.find((user: User) => user.id === selectedUserId);
    let index = this.userService.users.findIndex((user: User) => user.id === selectedUserId);
    this.clickUserContainer(user!, index);
  }


  clickUserContainer(user: User, i: number) {
    this.userService.clickedUsers.fill(false);
    this.channelsService.clickedChannels.fill(false);
    this.userService.clickedUsers[i] = true;
    this.getUserName(user);
    this.clickUserEvent.emit();
    console.log('User clicked:', user);

    if (this.authService.currentUserUid) {

      this.currentConversation = this.directMessages
      .filter((message: DirectMessage) => {
        return message.senderId === user.id || message.receiverId === user.id;
      })
      .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

      this.chatUtilityService.setMessageId(null);
      this.setAllMessagesAsRead();
    }
    console.log('Current Conversation:', this.currentConversation);
    
  }


  private subscribeToSentMessages(sentMessagesQuery: any, currentUserUid: string | undefined) {
    return onSnapshot(sentMessagesQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
      this.directMessages = await this.processMessages(snapshot, currentUserUid, true);
    });
  }

  private subscribeToReceivedMessages(receivedMessagesQuery: any, currentUserUid: string | undefined) {
    return onSnapshot(receivedMessagesQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
      const receivedMessages = await this.processMessages(snapshot, currentUserUid, false);
      this.directMessages = [...this.directMessages.filter(m => m.isOwnMessage), ...receivedMessages];
    });
  }


  async loadDirectMessages(currentUserUid: string | undefined, targetUserId: string | null | undefined) {
    if (targetUserId) {
      // Lade den Benutzer basierend auf der targetUserId und setze selectedUser
      this.chatUtilityService.directMessageUser = await this.loadSelectedUser(targetUserId);
    }

    const messagesRef = collection(this.firestore, 'direct_messages');
    const sentMessagesQuery = this.createSentMessagesQuery(messagesRef, currentUserUid, targetUserId);
    const receivedMessagesQuery = this.createReceivedMessagesQuery(messagesRef, currentUserUid, targetUserId);

    const unsubscribeSent = this.subscribeToSentMessages(sentMessagesQuery, currentUserUid);
    const unsubscribeReceived = this.subscribeToReceivedMessages(receivedMessagesQuery, currentUserUid);

    // Optional: Rückgabefunktion zum Abmelden von Snapshots
    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }


  // async loadDirectMessages(currentUserUid: string | undefined, targetUserId: string | null | undefined) {

  //   const messagesRef = collection(this.firestore, 'direct_messages');
  //   const receivedMessagesQuery = query(messagesRef, where('receiverId', '==', currentUserUid), orderBy('timestamp'));
  //   const unsubscribeReceived = this.subscribeToReceivedMessages(receivedMessagesQuery, currentUserUid);

  //   // Optional: Rückgabefunktion zum Abmelden von Snapshots
  //   return () => {
  //     unsubscribeReceived();
  //   };
  // }


  private createSentMessagesQuery(messagesRef: any, currentUserUid: string | undefined, targetUserId: string | null | undefined) {
    return query(
      messagesRef,
      where('senderId', '==', currentUserUid),
      where('receiverId', '==', targetUserId),
      orderBy('timestamp')
    );
  }

  private createReceivedMessagesQuery(messagesRef: any, currentUserUid: string | undefined, targetUserId: string | null | undefined) {
    return query(
      messagesRef,
      where('receiverId', '==', currentUserUid),
      where('senderId', '==', targetUserId),
      orderBy('timestamp')
    );
  }


  async loadDirectMessagesAsPromise(): Promise<DirectMessage[]> {
    let directMessagesRef = collection(this.firestore, 'direct_messages');
    let directMessagesQuery = query(directMessagesRef, orderBy('timestamp'));
    const querySnapshot = await getDocs(directMessagesQuery);

    this.directMessages = querySnapshot.docs
      .map(doc => {
        let directMessageData = doc.data() as DirectMessage;
        return { ...directMessageData, messageId: doc.id, timestamp: directMessageData.timestamp || new Date() };
      })
      .filter(directMessage =>
        directMessage.receiverId === this.authService.currentUserUid ||
        directMessage.senderId === this.authService.currentUserUid
      );

    console.log('Filtered Direct Messages:', this.directMessages);

    return this.directMessages;
  }


  async loadConversations(message: DirectMessage): Promise<void> {
    const q = query(collection(this.firestore, 'direct_messages'), where('senderID', '==', this.authService.currentUserUid));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (doc) => {
      const message = doc.data() as DirectMessage;
    });
  }


  private async processMessages(snapshot: QuerySnapshot<DocumentData>, currentUserUid: string | undefined, isSent: boolean) {
    let lastDisplayedDate: string | null = null;

    return Promise.all(snapshot.docs.map(async (doc) => {
      const messageData = doc.data();
      const message = new DirectMessage(messageData, currentUserUid);
      const conversation: DirectMessage[] = messageData['conversation'];
      message.messageId = doc.id;

      await this.processConversation(conversation, currentUserUid, lastDisplayedDate);
      this.chatUtilityService.setMessageId(doc.id);

      return message;
    }));
  }

  private async processConversation(conversation: DirectMessage[], currentUserUid: string | undefined, lastDisplayedDate: string | null) {
    await Promise.all(conversation.map(async (msg: DirectMessage) => {
      await this.loadSenderAvatar(msg);
      this.setMessageDisplayDate(msg, lastDisplayedDate, currentUserUid);
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

  private setMessageDisplayDate(msg: DirectMessage, lastDisplayedDate: string | null, currentUserUid: string | undefined) {
    const messageTimestamp = msg.timestamp;
    if (messageTimestamp instanceof Timestamp) {
      const messageDate = messageTimestamp.toDate();
      const formattedDate = this.messagesService.formatTimestamp(messageDate);
      msg.isOwnMessage = (msg.senderId === currentUserUid);

      // Setze das Anzeigen-Datum
      if (formattedDate !== lastDisplayedDate) {
        msg.displayDate = formattedDate;
        lastDisplayedDate = formattedDate;
      } else {
        msg.displayDate = null;
      }

      // Setze formattedTimestamp für die Nachricht
      msg.formattedTimestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      console.error("Timestamp is not defined or in the expected format.", msg);
    }
  }


  getUserName(user: User) {
    this.chatUtilityService.directMessageUser = user;
  }


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
        this.listenToConversations()
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
        where('conversation.receiverId', '==', this.authService.currentUserUid) // nur Konversationen des aktuellen Benutzers
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
          userConversations.forEach((conv: any) => {
            if (!unreadMessagesBySender[conv.senderId]) {
              unreadMessagesBySender[conv.senderId] = 0;
            }
            unreadMessagesBySender[conv.senderId]++;
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


  private async loadSelectedUser(targetUserId: string) {
    return await this.userService.getSelectedUserById(targetUserId);
  }
}