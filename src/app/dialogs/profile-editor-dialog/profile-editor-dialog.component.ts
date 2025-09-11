import { Component, inject, Input, signal, WritableSignal } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { SendMessageService } from '../../shared/services/messages/send-message.service';
import { User } from '../../shared/models/user.class';
import { AvatarsService } from '../../shared/services/avatars/avatars.service';

@Component({
  selector: 'app-profile-editor-dialog',
  standalone: true,
  imports: [FormsModule, CommonModule, NgFor, NgIf],
  templateUrl: './profile-editor-dialog.component.html',
  styleUrl: './profile-editor-dialog.component.scss'
})
export class ProfileEditorDialogComponent {
  // @Input() currentUser!: WritableSignal<User | null | undefined>;

  fullname: string | null | undefined;
  mail: string | null | undefined;
  avatarPath: string | null | undefined;
  changesSuccessful = signal<boolean>(false);
  openAvatarSelector: boolean = false;
  selectedAvatar: string | null | undefined;

  authService = inject(AuthService);
  userService = inject(UserService);
  messagesService = inject(MessagesService);
  channelsService = inject(ChannelsService);
  threadService = inject(SendMessageService);
  avatarsService = inject(AvatarsService);


  constructor() {
  }

  ngOnInit() {
    if (this.authService.currentUser()) {
      this.fullname = this.authService.currentUser()?.name;
      this.mail = this.authService.currentUser()?.email;
      this.avatarPath = this.authService.currentUser()?.avatarPath;
      this.selectedAvatar = this.avatarPath;
    }
  }




  async onSubmit(ngForm: NgForm): Promise<void> {
    if (ngForm.submitted && ngForm.form.valid) {
      if (this.authService.currentUser()) {
        let updatedUser = this.getUpdatedUser();
        await this.authService.updateUserProfile({ displayName: this.fullname, photoURL: this.avatarPath });
        this.updateCurrentUserMessages();
        this.updateCurrentUserChannels();
        this.updateCurrentUserThreads();
        if (this.mail !== this.authService.currentUser()?.email) {
          // check if email is used
          await this.authService.updateEmail(this.mail!);
        }

        await this.userService.updateUserInFirestore(updatedUser!.id!, updatedUser!)
        this.authService.currentUser.set(updatedUser)
        this.changesSuccessful.set(true);
      }
      this.closeAllDialogs();
    }
  }


  updateCurrentUserMessages() {
    this.messagesService.getMessagesFromCurrentUser();
  }


  updateCurrentUserChannels() {
    this.channelsService.getChannelsFromCurrentUser();
  }


  updateCurrentUserThreads() {
    this.threadService.getThreadsFromCurrentUser();
  }


  getUpdatedUser(): User | undefined {
    if (this.authService.currentUser()) {
      return {
        ...this.authService.currentUser(),
        name: this.fullname!,
        email: this.mail!,
        avatarPath: this.avatarPath!
      } as User
    } else {
      return;
    }
  }


  stopPropagation(event: Event) {
    event.stopPropagation();
  }


  closeUserProfileEditor() {
    this.userService.showProfileEditor.set(false);
    this.userService.showProfile.set(true);
  }


  closeAllDialogs() {
    this.userService.showProfileEditor.set(false);
    this.userService.showProfile.set(false);
    this.userService.showOverlay.set(false);
  }


  openAvatarSelection() {
    this.openAvatarSelector = true;
  }


  chooseAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.saveAvatar();
  }


  closeAvatarSelection() {
    this.selectedAvatar = this.avatarPath;
    this.openAvatarSelector = false;
  }


  saveAvatar() {
    this.avatarPath = this.selectedAvatar;
    this.openAvatarSelector = false;
  }



  uploadAvatar($event: Event) {
    const fileInput = $event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  }
}
