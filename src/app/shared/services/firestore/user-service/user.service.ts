// Service for all Functions related to the User Object in Firestore

import { Injectable, signal } from '@angular/core';
import { Firestore, collection, doc, getDoc, updateDoc, setDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { User } from '../../../models/user.class';
import { getDocs } from 'firebase/firestore';
import { FirestoreConnectionManager } from '../../firestore-connection-manager.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  public user: User = new User();
  public user$!: Observable<User[]>;
  private userSignal = signal<User | null | undefined>(undefined);
  public currentUser = this.getUserSignal(); // Change to hold an instance of the User class
  public currentUserID: string | null = null;
  showProfile = signal<boolean>(false);
  showUserInfo = signal<boolean>(false);
  showProfileEditor = signal<boolean>(false);
  showOverlay = signal<boolean>(false);
  users: User[] = [];
  // Array to hold the clicked state of each user
  clickedUsers: boolean[] = []; // maybe use a Map instead of an array/ maybe move to another service?
  selectedUser: User | null = null;
  selectedUserId: string = '';

  constructor(
    private firestore: Firestore,
    private connectionManager: FirestoreConnectionManager
  ) {
    this.loadUsers(); // Pass the user ID to loadChannels
  }


  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    this.connectionManager.registerListener(
      'users-collection',
      usersQuery,
      async (snapshot: any) => {
        this.users = await Promise.all(snapshot.docs.map(async (doc: any) => {
          let userData = doc.data() as User;
          return { ...userData, id: doc.id };
        }));
      },
      (error: any) => {
        console.error('Failed to load users:', error);
      }
    );
  }


  async loadUsersAsPromise(): Promise<User[]> {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));
    const querySnapshot = await getDocs(usersQuery);
    this.users = querySnapshot.docs.map(doc => {
      let userData = doc.data() as User;
      return { ...userData, id: doc.id };
    });
    return this.users;
  }


  getUserSignal() {
    return this.userSignal;
  }


  setUser(user: User | null | undefined) {
    this.userSignal.set(user);
  }


  updateUserInFirestore(uid: string, data: any) {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userDocRef, data);  // Aktualisiert das Benutzer-Dokument
  }


  async updateUserLoginState(userId: string, loginState: string) {
    try {
      let userRef = this.getUserDocReference(userId);
      await updateDoc(userRef, { loginState: loginState });
    } catch (error) {
      console.error('Error updating user', error);
    }
  }


  async updateUserDoc(userId: string, newUser: User) {
    try {
      let userRef = this.getUserDocReference(userId);
      await updateDoc(userRef, { ...newUser });
    } catch (error) {

    }
  }


  getUserDocReference(docId: string) {
    return doc(this.getUserCollectionReference(), docId)
  }


  getUserCollectionReference() {
    return collection(this.firestore, 'users');
  }


  createFirestoreUser(user: any): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    return setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.name,
      avatarPath: user.avatarPath,
      loginState: 'loggedOut', // Leerer loginState
      channels: [],
    });
  }


  async getSelectedUserById(userId: string): Promise<User | null> {
    // this.showUserInfo.set(true);
    // console.log(this.showUserInfo);

    const userRef = this.getUserDocReference(userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as User; // Access document data

      this.selectedUser = new User({
        ...userData,
        id: userDoc.id,
        loginState: userData?.loginState // Use optional chaining to safely access loginState
      });

      return this.selectedUser;
    } else {
      return null;
    }
  }


  async getSelectedUserAvatar(userId: string) {
    const userRef = this.getUserDocReference(userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as User; // Access document data
      const selectedUserAvatar = userData.avatarPath;
      return selectedUserAvatar;
    } else {
      return null;
    }
  }


  openUserProfile(event: Event) {
    event.stopPropagation();
    this.showProfile.set(true);
    this.showOverlay.set(true);
  }
}