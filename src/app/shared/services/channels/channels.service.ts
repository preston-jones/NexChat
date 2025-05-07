import { Injectable, OnInit, signal, EventEmitter, Output } from '@angular/core';
import { Firestore, doc, onSnapshot, collection, query, orderBy, arrayUnion } from '@angular/fire/firestore';
import { Channel } from '../../models/channel.class';
import { User } from '../../models/user.class';
import { Observable } from 'rxjs';
import { AuthService } from '../authentication/auth-service/auth.service';
import { UserService } from '../firestore/user-service/user.service';
import { getDocs, updateDoc, where, getDoc } from 'firebase/firestore';
import { MessagesService } from '../messages/messages.service';

@Injectable({
  providedIn: 'root',
})
export class ChannelsService {
  clickUserEvent = new EventEmitter<void>();

  preventScroll = false;
  clickedChannels: boolean[] = [];
  clickedUsers: boolean[] = [];
  currentChannelName: string = '';
  currentChannelDescription: string = 'Keine Kanalbeschreibung vorhanden';
  currentChannelAuthor: string = '';
  currentChannelId: string = '';
  currentChannelMemberUids: string[] = [];
  currentChannelMembers: User[] = [];
  showMembersInfo = signal<boolean>(false);
  showAddMemberDialog = signal<boolean>(false);
  memberAddedInfo: boolean = false;
  channelCreatedInfo: boolean = false;
  channelIsClicked: boolean = false;

  public channel: Channel = new Channel();
  public channel$!: Observable<Channel>;
  public channels: Channel[] = [];
  public currentUserChannels: Channel[] = [];

  @Output() clearAndFocusTextarea = new EventEmitter<void>();


  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private userService: UserService,
    // private messagesService: MessagesService,
  ) {
    // // Initialize authentication state listener
    // this.authService.auth.onAuthStateChanged((user) => {
    //   if (user) {
    //     this.loadChannels(user.uid); // Pass the user ID to loadChannels
    //   } else {
    //     // Handle the case where the user is not logged in
    //     console.log('No user logged in');
    //   }
    // });
  }


  openChannel(selectedUserId: string | null | undefined) {
    // let channel = this.channels.find((channel: Channel) => channel.memberUids === selectedUserId);
    // let index = this.userService.users.findIndex((user: User) => user.id === selectedUserId);
    // this.clickChannelContainer(channel!, index);
  }


  triggerClearAndFocus() {
    this.clearAndFocusTextarea.emit();
  }


  resetSrollPrevent() {
    this.preventScroll = false;
  }


  clickChannelContainer(channel: Channel, i: number) {
    this.resetSrollPrevent();
    this.triggerClearAndFocus();
    this.clickedChannels.fill(false);
    this.clickedUsers.fill(false);
    this.clickedChannels[i] = true;
    this.getChannelData(channel);
    this.getChannelUsers(channel);
    this.currentChannelId = channel.id;
    this.clickUserEvent.emit();
  }


  async loadChannels(): Promise<void> {
    let channelsRef = collection(this.firestore, 'channels');
    let channelsQuery = query(channelsRef, orderBy('name'));

    onSnapshot(channelsQuery, async (snapshot) => {
      this.currentUserChannels = snapshot.docs
        .map(doc => {
          const channelData = doc.data() as Channel;
          return {
            ...channelData, id: doc.id
          };
        })
        .filter(userChannel =>
          userChannel.memberUids.includes(this.authService.currentUserUid) || userChannel.channelAuthorId === this.authService.currentUserUid
        );
      // this.channels.forEach(async channel => {
      //   this.messagesService.loadMessages(channel.id, this.authService.currentUserUid);
      // });
      this.orderChannels();
      console.log('Real-time Channels:', this.currentUserChannels);
    });
  }


  orderChannels() {
    // Ensure the channel with the Name 'Willkommen' is always first
    const wellcomeChannel = 'Willkommen';
    const specialChannelIndex = this.currentUserChannels.findIndex(channel => channel.name === wellcomeChannel);
    if (specialChannelIndex !== -1) {
      const [specialChannel] = this.currentUserChannels.splice(specialChannelIndex, 1);
      this.currentUserChannels.unshift(specialChannel);
    }
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
    this.currentChannelMembers = [];
    this.channel = channel;
  }


  getChannelUsers(channel: Channel) {
    channel.memberUids.forEach(async (uid) => {
      this.userService.getSelectedUserById(uid).then((user) => {
        if (this.currentChannelMembers && user) {
          this.currentChannelMembers.push(user);
        }
      });
    });
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


  async updateUserChannels(userId: string, channelName: string) {
    let usersRef = collection(this.firestore, 'users');
    let userDocRef = doc(usersRef, userId);
    let userData = await getDoc(userDocRef);
    let user = userData.data() as User;

    await updateDoc(userDocRef, {
      channels: arrayUnion(channelName),
    });
  }


  async addCurrentUserToChannel(currentUser: User, channelId: string) {
    let channelRef = collection(this.firestore, 'channels');
    let channelDocRef = doc(channelRef, channelId);
    let channelData = await getDoc(channelDocRef);
    let channel = channelData.data() as Channel;

    await updateDoc(channelDocRef, {
      memberUids: arrayUnion(currentUser.id),
      members: arrayUnion(currentUser)
    });
  }


  async addUserToChannel(selectedUsers: User[], currentChannelId: string) {
    let channelsRef = collection(this.firestore, 'channels');
    let channelDocRef = doc(channelsRef, currentChannelId);
    let channelDoc = await getDoc(channelDocRef);
    if (channelDoc.exists()) {
      try {
        await updateDoc(channelDocRef, {
          members: arrayUnion(...selectedUsers),
          memberUids: arrayUnion(...selectedUsers.map(user => user.id))
        });

        this.closeAddMemberDialog();
        this.closeMembersDialog();
        this.memberAddedInfo = true;
        setTimeout(() => {
          this.memberAddedInfo = false;
        }, 0);

      } catch (error) {
        console.error("Fehler beim Aktualisieren des Channels:", error);
      }
    }
  }
}