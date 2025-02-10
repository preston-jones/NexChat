import { NgFor } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../shared/services/firestore/user-service/user.service';


@Component({
  selector: 'app-members-dialog',
  standalone: true,
  imports: [
    NgFor,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './members-dialog.component.html',
  styleUrl: './members-dialog.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class MembersDialogComponent {


  constructor(
    public channelsService: ChannelsService,
    public userService: UserService
  ) {}

   async showProfile(selectedUserId: string) {
    this.channelsService.showMembersInfo.set(false);
    this.userService.showUserInfo.set(true);
    await this.userService.getSelectedUserById(selectedUserId as string);
  }

  openAddMemberDialog() {
    
  }
}
