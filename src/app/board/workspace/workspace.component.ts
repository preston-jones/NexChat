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
import { User } from '../../shared/models/user.class';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { ChatUtilityService } from '../../shared/services/messages/chat-utility.service';
import { Overlay } from '@angular/cdk/overlay';
import { MatBadgeModule } from '@angular/material/badge';
import { SearchDialogComponent } from '../../dialogs/search-dialog/search-dialog.component';
import { FormsModule } from '@angular/forms';
import { BoardComponent } from '../board.component';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { DirectMessagesService } from '../../shared/services/messages/direct-messages.service';
import { initializeApp } from 'firebase/app';

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
  directMessages: any = [];
  users: User[] = [];
  clickedChannels: boolean[] = [];
  // clickedUsers: boolean[] = [];
  icons: string[] = [];
  panelOpenState = false;
  arrowRotated: boolean[] = [false, false];
  isUnread: boolean = false;
  currentUserChannels: Channel[] = [];
  userConversationCount: number = 0;
  unreadMessagesCount: number = 0;
  searchInput: string = '';
  @Input() openChatWindow!: () => void;
  @Output() openChannelEvent = new EventEmitter<void>();
  @Output() clickUserEvent = this.directMessagesService.clickUserEvent;

  triggerOpenChat() {
    this.chatUtilityService.openChatWindow();
  }


  constructor(
    public dialog: MatDialog,
    private iconsService: IconsService,
    public channelsService: ChannelsService,
    public authService: AuthService,
    private messagesService: MessagesService,
    public userService: UserService,
    private chatUtilityService: ChatUtilityService,
    private overlay: Overlay,
    private boardComponent: BoardComponent,
    public directMessagesService: DirectMessagesService
  ) { }

  ngOnInit() {
    this.chatUtilityService.openDirectMessageEvent.subscribe(({ selectedUser, index }) => {
      this.directMessagesService.clickUserContainer(selectedUser, index);
    });

    this.chatUtilityService.openChannelMessageEvent.subscribe(({ selectedChannel, index }) => {
      this.openChannel(selectedChannel, index);
    });

    this.initializeChannels();
  }


  initializeChannels() {
    this.channelsService.channelIsClicked = true;
    this.channelsService.clickedChannels.fill(false);
    this.channelsService.clickedUsers.fill(false);
    this.channelsService.clickedChannels[0] = true;
    this.channelsService.currentChannelName = 'Willkommen';
    this.channelsService.currentChannelId = 'mH2jwT76WrAhdu9LZC5h';
    this.openChannelEvent.emit();
  }


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
    if (this.authService.currentUserUid) {
      this.messagesService.loadMessages(this.authService.currentUserUid, channel.id);
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