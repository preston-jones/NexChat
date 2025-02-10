import { Component, EventEmitter, inject, Input, Output, WritableSignal } from '@angular/core';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { User } from '../../shared/models/user.class';

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [],
  templateUrl: './profile-dialog.component.html',
  styleUrl: './profile-dialog.component.scss'
})
export class ProfileDialogComponent {
  // @Input() currentUser!: WritableSignal<User | null | undefined>;

  authService = inject(AuthService);
  userService = inject(UserService);

  readonly GUESTID = 'ZnyRrhtuIBhdU3EYhDw5DueQsi02';
  

  constructor() {
  }


  stopPropagation(event: Event) {
    event.stopPropagation();
  }


  closeUserProfile() {
    this.userService.showProfile.set(false);
  }


  openUserEditor(event: Event) {
    event.stopPropagation();
    this.userService.showProfile.set(false);
    this.userService.showProfileEditor.set(true);
  }
}