import { Component, ViewEncapsulation  } from '@angular/core';
import { FormControl, FormsModule, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { IconsService } from '../../shared/services/icons/icons.service';
import { Channel } from '../../shared/models/channel.class';
import { arrayUnion, collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { User } from '../../shared/models/user.class';
import { Auth } from '@angular/fire/auth';
import { NgIf, NgStyle } from '@angular/common';

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-channel-description-dialog',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatDialogModule,
    MatIconModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    NgIf,
    NgStyle
  ],
  templateUrl: './channel-description-dialog.component.html',
  styleUrls: ['./channel-description-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ChannelDescriptionDialogComponent {

  nameFormControl = new FormControl('', [Validators.required]);
  matcher: MyErrorStateMatcher = new MyErrorStateMatcher();
  formSubmitted = false;
  currentChannel: Channel | any = [];
  users: User[] = [];
  currentUser: User | any = [];
  currentChannelName: string = '';
  currentChannelDescription: string = '';
  editChannelName: boolean = false;
  editChannelDescription: boolean = false;

  constructor(
    public channelsService: ChannelsService,
    public iconsService: IconsService,
    public firestore: Firestore,
    private auth: Auth
  ) { 
    
  }

  ngOnInit(): void {
    this.currentChannel = this.channelsService.channel;
    this.currentChannelName = this.channelsService.currentChannelName;
    this.currentChannelDescription = this.channelsService.currentChannelDescription;
    this.loadUsers();
  }

  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    onSnapshot(usersQuery, async (snapshot) => {
        this.users = await Promise.all(snapshot.docs.map(async (doc) => {
            let userData = doc.data() as User;
            return { ...userData, id: doc.id };
        }));

        let currentUser = this.auth.currentUser;
        if (currentUser) {
            this.currentUser = this.findUserById(currentUser.uid);
            } else {
                console.log('Logged-in user not found in the users list.');
            }
        });
  }

  findUserById(userId: string): User | undefined {
    return this.users.find(user => user.id === userId);
}

  editDescription() {
    this.editChannelDescription = !this.editChannelDescription;
  }

  editName() {
    this.editChannelName = !this.editChannelName;
  }

  emptyInput(type: string) {
    if(type === 'description') {
    this.currentChannelDescription = '';
  } else if(type === 'name') {
    this.currentChannelName = '';
    }
  }

  onBlur(type: string) {
    if (!this.currentChannelName && type === 'name') {
      this.currentChannelName = this.channelsService.currentChannelName;
    } else if (!this.currentChannelDescription && type === 'description') {
      this.currentChannelDescription = this.channelsService.currentChannelDescription;
    }
  }

  async updateCurrentChannel(type: string) {
    let channelsRef = collection(this.firestore, 'channels');
    let currentChannelName = this.currentChannelName;
    let currentChannelDescription = this.currentChannelDescription;
    let currentChannelId = this.currentChannel.id;
    let channelDocRef = doc(channelsRef, currentChannelId);
  
    try {
      let channelDoc = await getDoc(channelDocRef);
  
      if (channelDoc.exists()) {
        if (type === 'name' && currentChannelName) {
          await updateDoc(channelDocRef, {
            name: currentChannelName
          });
          this.editChannelName = false;
          this.channelsService.currentChannelName = currentChannelName;
          
        } else if (type === 'description' && currentChannelDescription) {
          await updateDoc(channelDocRef, {
            description: currentChannelDescription
          });
          this.editChannelDescription = false;
          
        }

      } else {
        console.log("Channel existiert nicht");
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Channels:", error);
    }
  }

  async quitChannel() {
    let currentUserId = this.currentUser.id;
    let currentChannelId = this.currentChannel.id;
    let channelsRef = collection(this.firestore, 'channels');
    let channelDocRef = doc(channelsRef, currentChannelId);
  
    try {
      let channelDoc = await getDoc(channelDocRef);
      if (channelDoc.exists()) {
        let channelData = channelDoc.data();
        
        let updatedMembers = channelData['members'].filter((member: any) => member.uid !== currentUserId);
        let updatedMemberUids = channelData['memberUids'].filter((uid: any) => uid !== currentUserId);
  
        await updateDoc(channelDocRef, {
          members: updatedMembers,
          memberUids: updatedMemberUids
        });
        
        console.log(`User ${currentUserId} hat den Channel ${currentChannelId} verlassen.`);
      } else {
        console.log("Channel existiert nicht.");
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Channels:", error);
    }
  }
  
  
  subscribeToChannelUpdates(channelId: string) {
    let channelsRef = collection(this.firestore, 'channels');
    let channelDocRef = doc(channelsRef, channelId);
  
    onSnapshot(channelDocRef, (doc) => {
      if (doc.exists()) {
        let channelData = doc.data();
  
        if (channelData) {
          this.currentChannelName = channelData['name'] || this.currentChannelName;
          this.currentChannelDescription = channelData['description'] || this.currentChannelDescription;
        }
      } else {
        console.log("Channel existiert nicht");
      }
    });
  }

  
  
}


