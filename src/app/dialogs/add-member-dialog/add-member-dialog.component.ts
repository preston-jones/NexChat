import { NgFor, NgIf, NgStyle } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { User } from '../../shared/models/user.class';
import { Auth } from '@angular/fire/auth';
import { arrayUnion, collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { Channel } from '../../shared/models/channel.class';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-add-member-dialog',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    FormsModule,
    NgIf,
    NgStyle,
    NgFor,
    MatDialogModule,
    MatInputModule
  ],
  templateUrl: './add-member-dialog.component.html',
  styleUrls: ['./add-member-dialog.component.scss', 
    '../create-new-channel-dialog/create-new-channel-dialog.component.scss', 
    '../create-new-channel-dialog/add-people-dialog/add-people-dialog.component.scss' ],
    encapsulation: ViewEncapsulation.None

  
})
export class AddMemberDialogComponent implements OnInit {

  
  searchTermControl = new FormControl('', [Validators.required]); 

  selectedUsers: User[] = [];
  ownUserError: boolean = false;
  filteredUsers: User[] = [];
  userSelected: boolean = false;
  memberName: string = '';
  currentChannel: Channel | [] = [];
  currentChannelName: string = '';
  currentChannelMembers: string[] = [];
  users: User[] | [] = [];
  currentUser: User | any;
  currentUserUid: string | null = null;
  currentChannelId: string = '';

  constructor (
    private auth: Auth,
    private firestore: Firestore,
    public channelsService: ChannelsService,
  ) { }

  ngOnInit(): void {
    this.loadData();
    this.currentChannel = this.channelsService.channel;
    this.currentChannelName = this.channelsService.currentChannelName
    this.currentChannelId = this.channelsService.currentChannelId
    this.currentChannelMembers = this.channelsService.currentChannelMemberUids
  }

  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUserUid = user.uid;
        this.loadUsers(this.currentUserUid);
      } else {
      }
    });
  }

  async loadUsers(currentUserId: string) {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    onSnapshot(usersQuery, async (snapshot) => {
        this.users = await Promise.all(snapshot.docs.map(async (doc) => {
            let userData = doc.data() as User;
            return { ...userData, id: doc.id };
        }));
        this.loadCurrentUser(currentUserId);
      });
  }

  loadCurrentUser(currentUserId: string) {
    this.currentUser = this.users.find(user => user.id === currentUserId);
  }

  onSubmit(form: NgForm) {
    if (form.valid) {
      this.channelsService.addUserToChannel(this.selectedUsers, this.currentChannelId);
    } else {
    }
  }


  deleteUser(userId: string | null) {
    if (userId) {
      let userToDelete = this.selectedUsers.find(user => user.id === userId);
      this.selectedUsers = this.selectedUsers.filter(user => user.id !== userId);
      
      if (userToDelete) {
      } else {
      }
    }
  }


  filterUsers() {
    if (!this.memberName) {
      this.filteredUsers = this.users;
    } else {
      this.filteredUsers = this.users.filter(user =>
        user.name?.toLowerCase().includes(this.memberName.toLowerCase())
      );
    }
    if(this.memberName) {
      this.userSelected = true
    }
  }

  showUsers() {
    this.userSelected = !this.userSelected;
  }

  selectUser(user: User): void {
    this.userSelected! = this.userSelected;
    if (this.currentUserUid === user.id || this.currentChannelMembers.includes(user.id)) {
        this.ownUserError = true; 
    } else {
        if (!this.selectedUsers.find(selectedUser => selectedUser.id === user.id)) {
            this.selectedUsers.push(user);
            this.ownUserError = false; 
        } else {
            this.ownUserError = false;
        }
    }
  
    this.memberName = '';
    this.searchTermControl.reset();
  }


}
