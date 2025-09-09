import { ChangeDetectorRef, Component, EventEmitter, HostListener, ViewChild, ViewEncapsulation } from '@angular/core';
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
import { Message } from '../shared/models/message.class';
import { Auth } from '@angular/fire/auth';
import { ProfileEditorDialogComponent } from "../dialogs/profile-editor-dialog/profile-editor-dialog.component";
import { DirectMessageComponent } from './chat-window/direct-message/direct-message.component';
import { MessagesService } from '../shared/services/messages/messages.service';
import { ChannelMessageComponent } from './chat-window/channel-message/channel-message.component';
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
import { NoteService } from '../shared/services/notes/notes.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    WorkspaceComponent,
    MatButtonModule,
    MatSidenavModule,
    ThreadComponent,
    MatCardModule,
    MatIconModule,
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
    ChannelCreatedInfoComponent,
  ],
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.scss', '../../styles.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BoardComponent {

  @ViewChild(SearchDialogComponent) searchDialogComponent!: SearchDialogComponent;
  @ViewChild('drawer') drawer!: MatDrawer;
  // @ViewChild(WorkspaceComponent) workspaceComponent!: WorkspaceComponent;
  users: User[] = [];
  channels: Channel[] = [];
  searchInput: string = '';
  showThreadComponent: boolean = false;
  workspaceOpen = true;
  messages: Message[] = [];
  selectedUser: User | null = null;
  directMessageUser: User | null = null;
  selectedChannel: Channel | null = null;
  selectedMessage: Message | null = null;
  isSmallScreen: boolean = window.innerWidth < 1080;
  showChatWindow: boolean = false;
  showChannelMessage: boolean = false;
  showDirectMessage: boolean = false;
  messageIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  public openDirectMessageEvent: EventEmitter<{ selectedUser: User, index: number }> = new EventEmitter();
  public openChannelMessageEvent: EventEmitter<{ selectedChannel: Channel, index: number }> = new EventEmitter();


  constructor(
    public authService: AuthService,
    public userService: UserService,
    public messageService: MessagesService,
    public chatUtilityService: ChatUtilityService,
    public cd: ChangeDetectorRef,
    public channelsService: ChannelsService,
    public directMessagesService: DirectMessagesService,
    public noteService: NoteService,
  ) { }


  ngOnInit() {
    this.directMessagesService.loadDirectMessages();
    this.noteService.loadNotes();
    this.userService.loadUsers();
    this.channelsService.loadChannels();  
    this.messageService.loadAllChatMessages();
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
    if (!this.isSmallScreen) return;
    const groupLogo = document.querySelector('.hide-input-mobile') as HTMLElement;
    const devLogo = document.querySelector('.logo-container') as HTMLElement;

    // Check if elements exist before accessing their style properties
    if (groupLogo) {
      groupLogo.style.display = 'flex';
    }
    if (devLogo) {
      devLogo.style.display = 'none';
    }
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
      if (drawer) {
        drawer.style.removeProperty('transform');
      }
      if (sidenavContent) {
        sidenavContent.style.display = 'flex';
      }
      if (mobileBackArrow) {
        mobileBackArrow.style.display = 'flex';
      }
      if (groupLogo) {
        groupLogo.style.display = 'flex';
      }
      if (logoContainer) {
        logoContainer.style.display = 'none';
      }
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
      if (drawer) {
        drawer.style.setProperty('transform', 'translateX(0)');
      }
      if (sidenavContent) {
        sidenavContent.style.display = 'none';
      }
      if (mobileBackArrow) {
        mobileBackArrow.style.display = 'none';
      }
      if (groupLogo) {
        groupLogo.style.display = 'none';
      }
      if (logoContainer) {
        logoContainer.style.display = 'flex';
      }
    } else {
      console.warn('Element mit der Klasse mat-drawer-container wurde nicht gefunden.');
    }
  }

}