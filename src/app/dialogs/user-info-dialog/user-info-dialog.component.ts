import { Component, inject, EventEmitter, Output } from '@angular/core';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { ChatUtilityService } from '../../shared/services/messages/chat-utility.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { User } from '../../shared/models/user.class';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { DirectMessagesService } from '../../shared/services/messages/direct-messages.service';

@Component({
  selector: 'app-user-info-dialog',
  standalone: true,
  imports: [],
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss'
})
export class UserInfoDialogComponent {

  @Output() clickUserEvent = new EventEmitter<void>();

  userService = inject(UserService);
  messagesService = inject(MessagesService);
  chatUtilityService = inject(ChatUtilityService);
  authService = inject(AuthService);
  channelsService = inject(ChannelsService);
  directMessagesService = inject(DirectMessagesService);

  readonly GUESTID = 'ZnyRrhtuIBhdU3EYhDw5DueQsi02';


  constructor() {
  }


  stopPropagation(event: Event) {
    event.stopPropagation();
  }


  closeUserInfoDialog() {
    this.userService.showUserInfo.set(false);
  }
}
