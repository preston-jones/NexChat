import { Injectable, EventEmitter, Output } from '@angular/core';
import { UserService } from '../firestore/user-service/user.service';
import { MessagesService } from './messages.service';
import { ChatUtilityService } from './chat-utility.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { User } from '../../models/user.class';

@Injectable({
  providedIn: 'root'
})
export class DirectMessagesService {
  clickUserEvent = new EventEmitter<void>();

  workspaceOpen: boolean = false;
  showDirectMessage: boolean = true;
  showChannelMessage: boolean = false;
  showChatWindow: boolean = false;

  
  constructor(
    private userService: UserService,
    private messagesService: MessagesService,
    private chatUtilityService: ChatUtilityService,
    private authService: AuthService,
    private channelsService: ChannelsService
  ) {}


  openDirectMessage(selectedUserId: string | null | undefined) {
    let user = this.userService.users.find((user: User) => user.id === selectedUserId);
    let index = this.userService.users.findIndex((user: User) => user.id === selectedUserId);
    this.clickUserContainer(user!, index);
  }


  clickUserContainer(user: User, i: number) {
    this.userService.clickedUsers.fill(false);
    this.channelsService.clickedChannels.fill(false);
    this.userService.clickedUsers[i] = true;
    this.messagesService.getUserName(user);
    this.clickUserEvent.emit();
    if (this.authService.currentUserUid) {


// !!!! fuehrt zur zwischenladung aller Direjkt Nachrichten, bevor eigentliche Nachrichten geladen werden !!!!
      this.messagesService.loadDirectMessages(this.authService.currentUserUid, user.id);


      this.chatUtilityService.setMessageId(null);
      this.messagesService.setAllMessagesAsRead();
    }
  }
}