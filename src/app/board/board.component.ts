import { ChangeDetectorRef, Component, EventEmitter, HostListener, OnInit, ViewChild, ViewEncapsulation, WritableSignal, inject } from '@angular/core';
import { ChatWindowComponent } from "./chat-window/chat-window.component";
import { WorkspaceComponent } from "./workspace/workspace.component";
import { ThreadComponent } from './thread/thread.component';
import { CommonModule, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ProfileDialogComponent } from '../dialogs/profile-dialog/profile-dialog.component';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../shared/services/authentication/auth-service/auth.service';
import { UserService } from '../shared/services/firestore/user-service/user.service';
import { IconsService } from '../shared/services/icons/icons.service';
import { collection, Firestore, onSnapshot, orderBy, query } from '@angular/fire/firestore';
import { Message } from '../shared/models/message.class';
import { Auth } from '@angular/fire/auth';
import { ProfileEditorDialogComponent } from "../dialogs/profile-editor-dialog/profile-editor-dialog.component";
import { DirectMessageComponent } from './chat-window/direct-message/direct-message/direct-message.component';
import { MessagesService } from '../shared/services/messages/messages.service';
import { ChannelMessageComponent } from './chat-window/channel-message/channel-message/channel-message.component';
import { User } from '../shared/models/user.class';
import { Channel } from '../shared/models/channel.class';
import { ChatUtilityService } from '../shared/services/messages/chat-utility.service';
import { ChannelsService } from '../shared/services/channels/channels.service';
import { UserInfoDialogComponent } from "../dialogs/user-info-dialog/user-info-dialog.component";
import { SearchDialogComponent } from '../dialogs/search-dialog/search-dialog.component';
import { MembersDialogComponent } from '../dialogs/members-dialog/members-dialog.component';
import { AddMemberDialogComponent } from '../dialogs/add-member-dialog/add-member-dialog.component';
import { MemberAddedInfoComponent } from "../dialogs/member-added-info/member-added-info.component";
import { ChannelCreatedInfoComponent } from "../dialogs/channel-created-info/channel-created-info.component";
import { BehaviorSubject } from 'rxjs';
import { DirectMessagesService } from '../shared/services/messages/direct-messages.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    ChatWindowComponent,
    WorkspaceComponent,
    MatButtonModule,
    MatSidenavModule,
    ThreadComponent,
    MatCardModule,
    MatIconModule,
    ChatWindowComponent,
    WorkspaceComponent,
    ThreadComponent,
    CommonModule,
    NgIf,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    ProfileDialogComponent,
    ProfileEditorDialogComponent,
    DirectMessageComponent,
    ChannelMessageComponent,
    UserInfoDialogComponent,
    SearchDialogComponent,
    MembersDialogComponent,
    AddMemberDialogComponent,
    MemberAddedInfoComponent,
    ChannelCreatedInfoComponent
  ],
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.scss', '../../styles.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BoardComponent implements OnInit {

  @ViewChild(SearchDialogComponent) searchDialogComponent!: SearchDialogComponent;
  @ViewChild('drawer') drawer!: MatDrawer;
  // @ViewChild(WorkspaceComponent) workspaceComponent!: WorkspaceComponent;
  users: User[] = [];
  channels: Channel[] = [];
  searchInput: string = '';
  showThreadComponent: boolean = false;
  currentUser = this.authService.getUserSignal();
  workspaceOpen = true;
  messages: Message[] = [];
  selectedUser: User | null = null;
  directMessageUser: User | null = null;
  selectedChannel: Channel | null = null;
  currentUserUid: string | null | undefined = null;
  selectedMessage: Message | null = null;
  isSmallScreen: boolean = window.innerWidth < 1080;
  showChatWindow: boolean = false;
  showChannelMessage: boolean = false;
  showDirectMessage: boolean = false;
  messageIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  public openDirectMessageEvent: EventEmitter<{ selectedUser: User, index: number }> = new EventEmitter();
  public openChannelMessageEvent: EventEmitter<{ selectedChannel: Channel, index: number }> = new EventEmitter();


  constructor(
    private iconsService: IconsService,
    private firestore: Firestore,
    private auth: Auth,
    public authService: AuthService,
    public userService: UserService,
    public messageService: MessagesService,
    public chatUtilityService: ChatUtilityService,
    public cd: ChangeDetectorRef,
    public channelsService: ChannelsService,
    public directMessagesService: DirectMessagesService
  ) {
    this.currentUser = this.authService.getUserSignal();
  }


  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.isSmallScreen = window.innerWidth < 1080;
    this.changeLogoInHeader();
  }


  handleCloseSearchDialog(): void {
    this.searchInput = '';
  }


  changeLogoInHeader(): void {

    // if (!this.isSmallScreen) return;
    // const groupLogo = document.querySelector('hide-input-mobile') as HTMLElement;
    // const devLogo = document.querySelector('.logo-container') as HTMLElement;

    // groupLogo.style.display = 'flex';
    // devLogo.style.display = 'none';

  }

  async ngOnInit() {
    await this.loadData();
    this.channelsService.updateUserChannels(this.authService.currentUserUid, 'Wilkommen');
    const currentUser = this.userService.currentUser();
    if (currentUser) {
        await this.channelsService.addCurrentUserToChannel(currentUser as User, 'mH2jwT76WrAhdu9LZC5h');
    }
}

  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.loadUsers(); // Warten auf das Laden der Benutzer
        // console.log('Users array in ngOnInit:', this.users); // Hier wird das Array korrekt angezeigt
        await this.loadChannels();
        // console.log('Channels array in ngOnInit:', this.channels);
      } else {
        console.log('Kein Benutzer angemeldet');
      }
    });
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


  async loadChannels() {
    const channelRef = collection(this.firestore, 'channels');
    const channelQuery = query(channelRef, orderBy('name'));

    return new Promise((resolve) => {
      onSnapshot(channelQuery, async (snapshot) => {
        this.channels = await Promise.all(snapshot.docs.map(async (doc) => {
          const channelData = doc.data() as Channel;// Prüfen, ob Kanäle geladen werden
          return { ...channelData, id: doc.id };
        }));
        resolve(this.channels); // Promise auflösen
      });
    });
  }

  closeThread() {
    this.showThreadComponent = false;
    this.selectedMessage = null;
  }


  showThread(message: Message) {
    this.showThreadComponent = true;
    this.selectedMessage = message;
  }

  toggleWorkspace() {
    this.drawer.toggle();
    this.directMessagesService.workspaceOpen = !this.directMessagesService.workspaceOpen;
  }

  toggleWorkspaceMobile() {
    if (this.drawer) {
      this.drawer.toggle(); // Toggle-Funktion des Drawers
      this.goBack()
    }
    this.directMessagesService.workspaceOpen = !this.directMessagesService.workspaceOpen; // Zustand umschalten
  }

  // Methode zum expliziten Schließen (optional)
  closeWorkspace() {
    if (this.isSmallScreen && this.drawer) {
      this.drawer.close(); // Schließt den Drawer nur, wenn die Bedingung erfüllt ist
    }
    this.directMessagesService.workspaceOpen = false; // Zustand setzen
  }


  toggleProfileMenu() {
    this.userService.showOverlay.set(!this.userService.showOverlay());
  }

  openUserProfile(event: Event) {
    event.stopPropagation();
    this.userService.showProfile.set(true);
  }

  closeAllDialogs() {
    this.userService.showProfile.set(false);
  }

  closeUserInfoDialog() {
    this.userService.showUserInfo.set(false);
  }

  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  openChannelMessage() {
    this.closeWorkspace();
    this.directMessagesService.showChannelMessage = true;
    this.directMessagesService.showDirectMessage = false;
    this.directMessagesService.showChatWindow = false;
    this.adjustDrawerStylesForSmallScreen();
  }

  openChannelMessageFromChat(selectedChannel: Channel, index: number) {
    this.closeWorkspace();
    this.directMessagesService.showChannelMessage = true;
    this.directMessagesService.showDirectMessage = false;
    this.directMessagesService.showChatWindow = false;
    this.openChannelMessageEvent.emit({ selectedChannel, index });
    this.adjustDrawerStylesForSmallScreen();
  }

  openDirectMessage() {
    this.closeWorkspace();
    this.directMessagesService.showDirectMessage = true;
    this.directMessagesService.showChannelMessage = false;
    this.directMessagesService.showChatWindow = false;
    this.adjustDrawerStylesForSmallScreen();
  }

  openDirectMessageFromChat(selectedUser: User, index: number) {
    this.closeWorkspace();
    this.directMessagesService.showDirectMessage = true;
    this.directMessagesService.showChannelMessage = false;
    this.directMessagesService.showChatWindow = false;
    this.openDirectMessageEvent.emit({ selectedUser, index });
    this.adjustDrawerStylesForSmallScreen();
  }


  openChatWindow() {
    this.closeWorkspace();
    this.directMessagesService.showChatWindow = true;
    this.directMessagesService.showDirectMessage = false;
    this.directMessagesService.showChannelMessage = false;
    this.setMessageId(null);
    this.directMessageUser = null;
    this.selectedChannel = null;
    this.selectedUser = null;
    this.userService.selectedUser = null;
  }

  setMessageId(messageId: string | null) {
    this.messageIdSubject.next(messageId);
  }

  adjustDrawerStylesForSmallScreen(): void {
    if (!this.isSmallScreen) return;

    const drawerContainer = document.querySelector('.mat-drawer-container') as HTMLElement;
    const drawer = document.querySelector('.mat-drawer') as HTMLElement;
    const sidenavContent = document.querySelector('.sidenav-content') as HTMLElement;
    const mobileBackArrow = document.querySelector('.mobile-back-arrow') as HTMLElement;
    const groupLogo = document.querySelector('.group-logo') as HTMLElement;
    const logoContainer = document.querySelector('.logo-container') as HTMLElement;

    if (drawerContainer) {

      drawer.style.removeProperty('transform');
      sidenavContent.style.display = 'flex';
      mobileBackArrow.style.display = 'flex';
      groupLogo.style.display = 'flex';
      logoContainer.style.display = 'none';

    } else {
      console.warn('Element mit der Klasse mat-drawer-container wurde nicht gefunden.');
    }
  }

  goBack(): void {
    if (!this.isSmallScreen) return;

    const drawerContainer = document.querySelector('.mat-drawer-container') as HTMLElement;
    const drawer = document.querySelector('.mat-drawer') as HTMLElement;
    const sidenavContent = document.querySelector('.sidenav-content') as HTMLElement;
    const mobileBackArrow = document.querySelector('.mobile-back-arrow') as HTMLElement;
    const groupLogo = document.querySelector('.group-logo') as HTMLElement;
    const logoContainer = document.querySelector('.logo-container') as HTMLElement;

    if (drawerContainer) {

      drawer.style.setProperty('transform: none', 'translateX(0)');
      sidenavContent.style.display = 'none';
      mobileBackArrow.style.display = 'none';
      groupLogo.style.display = 'none';
      logoContainer.style.display = 'flex';

    } else {
      console.warn('Element mit der Klasse mat-drawer-container wurde nicht gefunden.');
    }
  }

}