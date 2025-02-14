import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { IconsService } from '../../shared/services/icons/icons.service';
import { NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { MatDialog } from '@angular/material/dialog';
import { CreateNewChannelDialog } from '../../dialogs/create-new-channel-dialog/create-new-channel-dialog.component';
import { Channel } from '../../shared/models/channel.class';
import { collection, doc, Firestore, getDocs, onSnapshot, orderBy, query, updateDoc, where } from '@angular/fire/firestore';
import { Auth, User as FirebaseUser } from '@angular/fire/auth';
import { User } from '../../shared/models/user.class';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { ChatUtilityService } from '../../shared/services/messages/chat-utility.service';
import { Overlay } from '@angular/cdk/overlay';
import { MatBadgeModule } from '@angular/material/badge';
import { Message } from '../../shared/models/message.class';
import { DirectMessage } from '../../shared/models/direct.message.class';
import { SearchDialogComponent } from '../../dialogs/search-dialog/search-dialog.component';
import { FormsModule } from '@angular/forms';
import { BoardComponent } from '../board.component';
import { UserService } from '../../shared/services/firestore/user-service/user.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatIconModule,
    MatCardModule,
    NgFor,
    NgClass,
    NgStyle,
    MatBadgeModule,
    NgIf,
    SearchDialogComponent,
    FormsModule
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class WorkspaceComponent implements OnInit {
  directMessages: DirectMessage[] = [];
  channels: Channel[] = [];
  users: User[] = [];
  clickedChannels: boolean[] = [];
  // clickedUsers: boolean[] = [];
  icons: string[] = [];
  panelOpenState = false;
  arrowRotated: boolean[] = [false, false];
  isUnread: boolean = false;
  currentUserUid: string | null = null;
  currentUserChannels: Channel[] = [];
  userConversationCount: number = 0;
  unreadMessagesCount: number = 0;
  searchInput: string = '';
  @Input() openChatWindow!: () => void;
  @Output() openChannelEvent = new EventEmitter<void>();
  @Output() clickUserEvent = new EventEmitter<void>();

  triggerOpenChat() {
    this.chatUtilityService.openChatWindow();
  }


  constructor(
    public dialog: MatDialog,
    private iconsService: IconsService,
    public channelsService: ChannelsService,
    public authService: AuthService,
    private firestore: Firestore,
    private auth: Auth,
    private messagesService: MessagesService,
    private userService: UserService,
    private chatUtilityService: ChatUtilityService,
    private overlay: Overlay,
    private boardComponent: BoardComponent
  ) {
  }

  ngOnInit() {
    this.authService.auth.onAuthStateChanged((user: FirebaseUser | null) => {
      if (user) {
        this.loadData(user); // Pass the user to loadData
        this.fillArraysWithBoolean();
      } else {
        console.log('No user logged in');
      }
    });

    this.chatUtilityService.openDirectMessageEvent.subscribe(({ selectedUser, index }) => {
      this.clickUserContainer(selectedUser, index);
    });

    this.chatUtilityService.openChannelMessageEvent.subscribe(({ selectedChannel, index }) => {
      this.openChannel(selectedChannel, index);
    });

    this.loadAllConversations();
  }

  async loadAllConversations(): Promise<void> {
    try {
      // Referenz zur gesamten Sammlung `direct_messages`
      const messagesCollectionRef = collection(this.firestore, 'direct_messages');

      // Abrufen aller Dokumente innerhalb der Sammlung
      const querySnapshot = await getDocs(messagesCollectionRef);

      // Initialisiere ein Mapping, um ungelesene Nachrichten pro Sender zu speichern
      const unreadMessagesBySender: { [key: string]: number } = {};

      // Durchlaufe jedes Dokument in der Sammlung
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const conversations = data['conversation'] || []; // Falls keine Konversationen vorhanden sind, leeres Array verwenden

        // Filtere Konversationen, bei denen der `currentUserUid` der Empfänger ist
        const userConversations = conversations.filter((conv: any) =>
          conv.receiverId === this.currentUserUid && !conv.readedMessage
        );

        // Für jede gefundene ungelesene Nachricht: Zähle die Nachrichten pro Sender
        userConversations.forEach((conv: any) => {
          if (!unreadMessagesBySender[conv.senderId]) {
            unreadMessagesBySender[conv.senderId] = 0;
          }
          unreadMessagesBySender[conv.senderId]++;
        });

        // Speichere alle Nachrichten
        this.directMessages.push({ messageId: doc.id, ...data } as DirectMessage);
      });

      // Weise den Benutzern in der Benutzerliste die ungelesenen Nachrichten zu
      this.users = this.users.map((user) => {
        return {
          ...user,
          unreadMessagesCount: unreadMessagesBySender[user.id] || 0, // Standardwert: 0
        };
      });

      // console.log('Ungelesene Nachrichten pro Sender:', unreadMessagesBySender);
    } catch (error) {
      console.error('Fehler beim Laden der Konversationen:', error);
    }
  }

  // async setAllMessagesAsRead(): Promise<void> {
  //   try {
  //     // Referenz zur gesamten Sammlung `direct_messages`
  //     const messagesCollectionRef = collection(this.firestore, 'direct_messages');

  //     // Abrufen aller Dokumente innerhalb der Sammlung
  //     const querySnapshot = await getDocs(messagesCollectionRef);

  //     // Durchlaufe jedes Dokument in der Sammlung
  //     for (const doc of querySnapshot.docs) {
  //       const data = doc.data();
  //       const conversations = data['conversation'] || [];

  //       // Aktualisiere nur die Konversationen, bei denen `receiverId` der aktuelle Benutzer ist
  //       const updatedConversations = conversations.map((conv: any) => {
  //         if (conv.receiverId === this.currentUserUid && !conv.readedMessage) {
  //           return { ...conv, readedMessage: true };
  //         }
  //         return conv;
  //       });

  //       // Überschreibe das Dokument mit den aktualisierten Konversationen
  //       await updateDoc(doc.ref, { conversation: updatedConversations });
  //       this.listenToConversations()
  //     }

  //     // console.log('Alle Nachrichten wurden als gelesen markiert.');
  //   } catch (error) {
  //     console.error('Fehler beim Aktualisieren der Nachrichten:', error);
  //   }
  // }

  // async listenToConversations(): Promise<void> {
  //   try {
  //     // Referenz zur gesamten Sammlung `direct_messages`
  //     const messagesCollectionRef = collection(this.firestore, 'direct_messages');

  //     // Filtere die Konversationen, bei denen der aktuelle Benutzer der Empfänger ist
  //     const q = query(
  //       messagesCollectionRef,
  //       where('conversation.receiverId', '==', this.currentUserUid) // nur Konversationen des aktuellen Benutzers
  //     );

  //     // Listener für Echtzeit-Updates
  //     onSnapshot(q, (querySnapshot) => {
  //       // Mapping der ungelesenen Nachrichten pro Sender
  //       const unreadMessagesBySender: { [key: string]: number } = {};

  //       querySnapshot.forEach((doc) => {
  //         const data = doc.data();
  //         const conversations = data['conversation'] || [];

  //         // Filtere ungelesene Nachrichten
  //         const userConversations = conversations.filter((conv: any) =>
  //           conv.receiverId === this.currentUserUid && !conv.readedMessage
  //         );

  //         // Zähle ungelesene Nachrichten für jeden Sender
  //         userConversations.forEach((conv: any) => {
  //           if (!unreadMessagesBySender[conv.senderId]) {
  //             unreadMessagesBySender[conv.senderId] = 0;
  //           }
  //           unreadMessagesBySender[conv.senderId]++;
  //         });
  //       });

  //       // Aktualisiere die Benutzerliste mit der Anzahl ungelesener Nachrichten
  //       this.users = this.users.map((user) => {
  //         return {
  //           ...user,
  //           unreadMessagesCount: unreadMessagesBySender[user.id] || 0, // Standardwert: 0
  //         };
  //       });

  //       // console.log('Ungelesene Nachrichten pro Sender:', unreadMessagesBySender);
  //     });
  //   } catch (error) {
  //     console.error('Fehler beim Überwachen der Konversationen:', error);
  //   }
  // }




  async loadData(user: FirebaseUser) {
    this.currentUserUid = user.uid; // Setze die currentUserUid hier
    await this.loadUsers();
    await this.channelsService.loadChannels(user.uid);
    // console.log(user.uid);
  }



  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    onSnapshot(usersQuery, async (snapshot) => {
      this.users = await Promise.all(snapshot.docs.map(async (doc) => {
        let userData = doc.data() as User;
        return { ...userData, id: doc.id };
      }));
      // this.loadCurrentUser(currentUserId);
    });
  }

  // loadCurrentUser(currentUserId: string) {
  //   this.currentUser = this.users.find(user => user.id === currentUserId);
  //   console.log(this.currentUser)
  // }

  fillArraysWithBoolean() {
    this.channelsService.initializeArrays(this.currentUserChannels.length, this.users.length);
  }

  // method to rotate arrow icon
  rotateArrow(i: number) {
    this.arrowRotated[i] = !this.arrowRotated[i];
  }

  // method to change background color for channel or user container
  openChannel(channel: Channel, i: number) {
    this.channelsService.channelIsClicked = true;
    this.channelsService.clickChannelContainer(channel, i);
    this.openChannelEvent.emit();
    if (this.currentUserUid) {
      this.messagesService.loadMessages(this.currentUserUid, channel.id);
    } else {
      console.error("currentUserUid is null");
    }
  }


  // helper method to toggle the clickContainer method
  openDialog() {
    this.dialog.open(CreateNewChannelDialog, {
      disableClose: false,
      hasBackdrop: true,
      scrollStrategy: this.overlay.scrollStrategies.noop()
    });
  }

  clickUserContainer(user: User, i: number) {
    this.userService.clickedUsers.fill(false);
    this.clickedChannels.fill(false);
    this.userService.clickedUsers[i] = true;
    this.messagesService.getUserName(user);
    this.clickUserEvent.emit();
    if (this.currentUserUid) {
      this.messagesService.loadDirectMessages(this.currentUserUid, user.id);
      this.chatUtilityService.setMessageId(null);
      // this.setAllMessagesAsRead()
      this.messagesService.setAllMessagesAsRead();
    } else {
      console.error("currentUserUid is null");
    }
  }

  toggleNewChatForMobile() {
    this.boardComponent.toggleWorkspace();
    this.boardComponent.openChatWindow();
    const sidenavContent = document.querySelector('.sidenav-content') as HTMLElement;
    const mobileBackArrow = document.querySelector('.mobile-back-arrow') as HTMLElement;
    const groupLogo = document.querySelector('.group-logo') as HTMLElement;
    const logoContainer = document.querySelector('.logo-container') as HTMLElement;

    sidenavContent.style.display = 'flex';
    mobileBackArrow.style.display = 'flex';
    groupLogo.style.display = 'flex';
    logoContainer.style.display = 'none';
  }
}