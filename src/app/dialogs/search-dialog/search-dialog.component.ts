import { NgIf } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { ChatUtilityService } from '../../shared/services/messages/chat-utility.service';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { User } from '../../shared/models/user.class';
import { Channel } from '../../shared/models/channel.class';
import { DirectMessage } from '../../shared/models/direct.message.class';
import { Message } from '../../shared/models/message.class';
import { Firestore, query } from '@angular/fire/firestore';
import { collection, getDocs, where } from 'firebase/firestore';
import { filter, find } from 'rxjs';


type SearchItem = User | DirectMessage | Channel | Message;

@Component({
  selector: 'app-search-dialog',
  standalone: true,
  imports: [],
  templateUrl: './search-dialog.component.html',
  styleUrl: './search-dialog.component.scss'
})
export class SearchDialogComponent implements OnChanges {
  @Input() searchValue!: any;
  @Output() sendEmptyString: EventEmitter<string> = new EventEmitter<string>();
  @Output() clickUserEvent = new EventEmitter<void>();
  @Output() openChannelEvent = new EventEmitter<void>();
  @Output() closeSearchEvent = new EventEmitter<void>();

  firestore = inject(Firestore);
  chatUtilityService = inject(ChatUtilityService);
  authService = inject(AuthService);
  channelsService = inject(ChannelsService);
  userService = inject(UserService);
  messagesService = inject(MessagesService);
  currentUser = this.authService.getUserSignal();

  showSearchDialog: boolean = false;
  mainSearchList: any[] = [];
  allData: (User | DirectMessage | Channel | Message)[] = [];
  messages: Message[] = [];


  ngOnInit() {
    this.loadAllData();

    // this.loadAllConversations();
  }


  async loadAllData() {
    this.authService.auth.onAuthStateChanged(async (user) => {
      this.allData = [];
      if (user) {
        let channels: Channel[] = await this.channelsService.loadChannelsAsPromise(user.uid);
        channels.forEach((channel: Channel) => { this.allData.push(channel) });
        let users: User[] = await this.userService.loadUsersAsPromise();
        users.forEach((user: User) => { this.allData.push(user) });
        let messages: Message[] = await this.messagesService.loadMessagesAsPromise();
        messages.forEach((message: Message) => { this.allData.push(message) });
        let directMessages: DirectMessage[] = await this.messagesService.loadDirectMessagesAsPromise();
        directMessages.forEach(async (directMessage: DirectMessage) => {
          if (this.authService.currentUserUid === directMessage.receiverId || this.authService.currentUserUid === directMessage.senderId) {
            this.allData.push(directMessage);
          }
          else {
            return;
          }
        });
      }
    });
  }


  openUserProfile(event: Event) {
    event.stopPropagation();
    this.userService.showProfile.set(true);
  }


  closeSearchDialog() {
    this.showSearchDialog = false;
    this.searchValue = '';
    this.closeSearchEvent.emit();
  }


  async getSelectedUserInfo(selectedUserId: string | null) {
    this.closeSearchDialog();
    this.userService.showUserInfo.set(true);
    await this.userService.getSelectedUserById(selectedUserId as string);
  }


  getChannelName(channelId: string) {
    let channel = this.channelsService.channels.find((channel: Channel) => channel.id === channelId);
    return channel ? channel.name : '';
  }


  ngOnChanges(changes: SimpleChanges) {
    setTimeout(() => {
      this.handleSearchChanges(changes);
    }, 100);
  }


  handleSearchChanges(changes: SimpleChanges): void {
    if (changes['searchValue'] && this.searchValue.length > 0) {
      this.showSearchDialogAndFilterItems();
    } else {
      this.closeSearchDialog();
    }
  }


  showSearchDialogAndFilterItems(): void {
    // console.log('allData =', this.allData);

    this.showSearchDialog = true;
    this.mainSearchList = this.filterSearchItems();
    // console.log('searchitems =', this.filterSearchItems());
    // console.log('mainSearchList =', this.mainSearchList);
  }


  filterUserById(userId: string) {
    if (this.userService.users) {
      let filteredUser = this.userService.users.find((user: User) => user.id === userId);
      return filteredUser;
    }
    return null;
  }


  filterSearchItems(): (User | DirectMessage | Channel | Message)[] {
    return this.allData.filter((ad: User | DirectMessage | Channel | Message) => {
      if (this.isUser(ad)) {
        return ad.name.toLowerCase().includes(this.searchValue.toLowerCase());
      } else if (this.isChannel(ad)) {
        return ad.name.toLowerCase().includes(this.searchValue.toLowerCase());
      } else if (this.isChatMessage(ad)) {
        return ad.message?.toLowerCase().includes(this.searchValue.toLowerCase());
      } else if (this.isDirectMessage(ad)) {
        return ad.conversation?.some(conversation => conversation.message?.toLowerCase().includes(this.searchValue.toLowerCase())) ?? false;
      } else {
        return false;
      }
    });
  }


  filterConversationMessage(directMessage: DirectMessage): boolean {
    if (!directMessage.conversation) {
      return false;
    }
    return directMessage.conversation.some(conversation =>
      conversation.message?.toLowerCase().includes(this.searchValue.toLowerCase())
    );
  }


  isUser(item: SearchItem): item is User {
    return (item as User).name !== undefined;
  }

  isChannel(item: SearchItem): item is Channel {
    return (item as Channel).name !== undefined;
  }

  isDirectMessage(item: SearchItem): item is DirectMessage {
    return (item as DirectMessage).conversation !== undefined;
  }

  isChatMessage(item: SearchItem): item is Message {
    return (item as Message).senderName !== undefined;
  }


  openChannel(channel: Channel, i: number) {
    this.closeSearchDialog();
    this.channelsService.channelIsClicked = true;
    this.channelsService.clickChannelContainer(channel, i);
    this.openChannelEvent.emit();
    if (this.authService.currentUserUid) {
      this.messagesService.loadMessages(this.authService.currentUserUid, channel.id);
    } else {
      console.error("FAIL!!!");
    }
  }


 async openDirectMessage(userId: string) {

    this.userService.clickedUsers.fill(false);

    // find the index of the clicked user
    let index = this.userService.users.findIndex((user: User) => user.id === userId);
    this.userService.clickedUsers[index] = true;

    this.closeSearchDialog();
    this.chatUtilityService.directMessageUser = await this.userService.getSelectedUserById(userId);
    this.clickUserEvent.emit();

    if (this.authService.currentUserUid && userId) {
      this.messagesService.loadDirectMessages(this.authService.currentUserUid, userId);
      this.chatUtilityService.setMessageId(null);
      this.messagesService.setAllMessagesAsRead();
    }
  }
}