import { Component, inject } from '@angular/core';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { ChatUtilityService } from '../../shared/services/messages/chat-utility.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';

@Component({
  selector: 'app-user-info-dialog',
  standalone: true,
  imports: [],
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss'
})
export class UserInfoDialogComponent {

  userService = inject(UserService);
  messagesService = inject(MessagesService);
  chatUtilityService = inject(ChatUtilityService);
  authService = inject(AuthService);

  readonly GUESTID = 'ZnyRrhtuIBhdU3EYhDw5DueQsi02';


  constructor() {
  }


  stopPropagation(event: Event) {
    event.stopPropagation();
  }


  closeUserInfoDialog() {
    this.userService.showUserInfo.set(false);
  }


  message(selectedUserId: string | null | undefined) {
    this.userService.showUserInfo.set(false);
    this.messagesService.loadDirectMessages(this.authService.currentUser()?.id as string, selectedUserId as string);
    this.chatUtilityService.openDirectMessage();
    console.log('selectedUserId', selectedUserId);
    console.log('this.userService.currentUserID', this.authService.currentUser()?.id);
    this.chatUtilityService.setMessageId(null);
  }
}
