import { Injectable, OnInit, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, collection, query, orderBy } from '@angular/fire/firestore';
import { Channel } from '../../models/channel.class';
import { User } from '../../models/user.class';
import { Observable } from 'rxjs';
import { AuthService } from '../authentication/auth-service/auth.service';
import { getDocs, updateDoc, where } from 'firebase/firestore';

@Injectable({
  providedIn: 'root',
})
export class ChannelsService implements OnInit {

  clickedChannels: boolean[] = [];
  clickedUsers: boolean[] = [];
  currentChannelName: string = '';
  currentChannelDescription: string = 'Keine Kanalbeschreibung vorhanden';
  currentChannelAuthor: string = '';
  currentChannelId: string = '';
  currentChannelMemberUids: string[] = [];
  currentChannelMembers: string[] | any;
  showMembersInfo = signal<boolean>(false);
  showAddMemberDialog = signal<boolean>(false);
  memberAddedInfo: boolean = false;
  channelCreatedInfo: boolean = false;
  channelIsClicked: boolean = false;

  public channel: Channel = new Channel();
  public channel$!: Observable<Channel>;
  public channels: Channel[] = [];
  public currentUserChannels: Channel[] = [];
  

  constructor(private firestore: Firestore, private authService: AuthService) {
    // Initialize authentication state listener
    this.authService.auth.onAuthStateChanged((user) => {
      if (user) {
        this.loadChannels(user.uid); // Pass the user ID to loadChannels
      } else {
        // Handle the case where the user is not logged in
        console.log('No user logged in');
      }
    });
  }

  ngOnInit(): void {
  }

  async loadChannels(currentUserId: string) {
    let channelsRef = collection(this.firestore, 'channels');
    let channelsQuery = query(channelsRef, orderBy('name'));

    onSnapshot(channelsQuery, async (snapshot) => {
      this.channels = await Promise.all(snapshot.docs.map(async (doc) => {
        let channelData = doc.data() as Channel;
        // console.log(currentUserId);

        return { ...channelData, id: doc.id };
      }));

      if (currentUserId) {
        let userChannels = this.channels.filter(channel => {
          return channel.memberUids && channel.memberUids.includes(currentUserId);
        });
        this.currentUserChannels = userChannels;
      } else {
        this.currentUserChannels = [];
      }
    });
  }


  async loadChannelsAsPromise(userId: string): Promise<Channel[]> {
    let channelsRef = collection(this.firestore, 'channels');
    let channelsQuery = query(channelsRef, where('memberUids', 'array-contains', userId));
    const querySnapshot = await getDocs(channelsQuery);
    this.channels = querySnapshot.docs.map(doc => {
      let channelData = doc.data() as Channel;
      return { ...channelData, id: doc.id };
    });
    return this.channels;
  }



  getChannelData(channel: Channel) {
    this.currentChannelName = channel.name;
    this.currentChannelDescription = channel.description;
    this.currentChannelAuthor = channel.channelAuthor;
    this.currentChannelId = channel.id;
    this.currentChannelMemberUids = channel.memberUids;
    this.currentChannelMembers = channel.members;
    this.channel = channel;
  }

  clickChannelContainer(channel: Channel, i: number) {
    this.clickedChannels.fill(false);
    this.clickedUsers.fill(false);
    this.clickedChannels[i] = true;
    this.getChannelData(channel);
    this.currentChannelId = channel.id;
  }

  initializeArrays(channelCount: number, userCount: number) {
    this.clickedChannels = new Array(channelCount).fill(false);
    this.clickedUsers = new Array(userCount).fill(false);
  }

  openMembersDialog() {
    this.showMembersInfo.set(true);
  }

  closeMembersDialog() {
    this.showMembersInfo.set(false);
  }

  openAddMemberDialog() {
    this.showAddMemberDialog.set(true);
  }

  closeAddMemberDialog() {
    this.showAddMemberDialog.set(false);
  }

  showMemberAddedInfo() {
    this.memberAddedInfo = true;
  }

  closeMemberAddedInfo() {
    this.memberAddedInfo = false;
  }

  closeChannelCreatedInfo() {
    this.channelCreatedInfo = false;
  }

  async getChannelsFromCurrentUser() {
    const q = query(collection(this.firestore, 'channels'), where('channelAuthorId', '==', this.authService.currentUserUid));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (doc) => {
      const channel = doc.data() as Channel;
      if (channel.channelAuthorId === this.authService.currentUserUid) {
        this.updateChannelAuthor(doc.id);
      }
    });
  }

  updateChannelAuthor(messageId: string) {
    const messageRef = doc(this.firestore, 'channels', messageId);
    updateDoc(messageRef, {
      channelAuthor: this.authService.currentUser()?.name,
    });
  }

  // needs to be moved to workspace



  //



  // async loadUsers() {
  //   let usersRef = collection(this.firestore, 'users');
  //   let usersQuery = query(usersRef, orderBy('name'));

  //   onSnapshot(usersQuery, async (snapshot) => {
  //     this.users = await Promise.all(snapshot.docs.map(async (doc) => {
  //       let userData = doc.data() as User;
  //       return { ...userData, id: doc.id };
  //     }));
  //   });
  //   console.log(this.users);
  // }



  // checkAuthState(): void {
  //   this.auth.onAuthStateChanged((user: User | null) => {
  //     if (user) {
  //       this.currentUserUid = user.uid;
  //       this.getUserChannels(user.uid);
  //     } else {
  //       console.log('Kein Benutzer angemeldet');
  //     }
  //   });
  // }

  // getCurrentUser(): string | null {
  //   const currentUser = this.auth.currentUser;
  //   if (currentUser) {
  //     this.currentUserUid = currentUser.uid;
  //     return currentUser.uid;
  //   } else {
  //     console.log('Kein Benutzer angemeldet');
  //     return null;
  //   }
  // }

  // getUserChannels(uid: string): void {
  //   const userDocRef = doc(this.firestore, `users/${uid}`);
  //   onSnapshot(userDocRef, (doc) => {
  //     if (doc.exists()) {
  //       const data = doc.data() as { channels: string[] };
  //       this.currentUserChannels = data.channels;
  //       console.log('Benutzerinformationen:', this.currentUserChannels);
  //     } else {
  //       console.log('Kein Benutzerdokument gefunden');
  //     }
  //   });
  // }

  // async loadChannels(): Promise<Channel[]> {
  //   const channelsRef = collection(this.firestore, 'channels');
  //   const channelsQuery = query(channelsRef, orderBy('name'));

  //   return new Promise((resolve) => {
  //     onSnapshot(channelsQuery, (snapshot) => {
  //       const channels = snapshot.docs.map((doc) => {
  //         const channelData = doc.data() as Channel;
  //         return { ...channelData, id: doc.id };
  //       });
  //       resolve(channels);
  //     });
  //   });
  // }

  //   async loadUsers(): Promise<User[]> {
  //     const usersRef = collection(this.firestore, 'users');
  //     const usersQuery = query(usersRef, orderBy('name'));

  //     return new Promise((resolve) => {
  //       onSnapshot(usersQuery, (snapshot) => {
  //         const users = snapshot.docs.map((doc) => {
  //           const userData = doc.data() as User;
  //           return { ...userData, id: doc.id };
  //         });
  //         resolve(users);
  //       });
  //     });
  //   }
}





