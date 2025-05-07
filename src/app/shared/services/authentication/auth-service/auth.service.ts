import { inject, Injectable, signal, EventEmitter, HostListener, Output } from '@angular/core';
import { Subscription, fromEvent } from 'rxjs';
import { Router } from '@angular/router';
import { confirmPasswordReset, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, verifyBeforeUpdateEmail, getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { UserCredential } from "firebase/auth";
import { UserService } from '../../firestore/user-service/user.service';
import { Auth, user, User as AuthUser } from '@angular/fire/auth';
import { User } from '../../../models/user.class';
import { doc, Firestore, getDoc, getFirestore, onSnapshot, setDoc, updateDoc, deleteDoc, where, query, collection, getDocs } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { Message } from '../../../models/message.class';
import { DirectMessage } from '../../../models/direct.message.class';
import { Dir } from '@angular/cdk/bidi';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  subscription: Subscription | null = null;
  sessionTimer: any = null;
  userIsActive: boolean = true;
  auth = inject(Auth);
  router = inject(Router);
  userService = inject(UserService);
  private userSignal = signal<User | null | undefined>(undefined);
  private authSubscription: Subscription | null = null;
  errorCode: string | null = null
  currentUserUid: string = '';
  currentUser = this.getUserSignal(); // Change to hold an instance of the User class
  // GUEST_UID = 'ZnyRrhtuIBhdU3EYhDw5DueQsi02';

  @Output() userUpdated: EventEmitter<User | null | undefined> = new EventEmitter();

  constructor(private firestore: Firestore) {
    this.initializeAuthState();
    this.userUpdated.subscribe((user) => {
      this.userService.setUser(user);

      // if (user != null && user != undefined && user.loginState === 'loggedIn') {
      //   this.startSessionTimer();
      //   this.resetSessionTimer();
      // }

      console.log('auth.service.currentUser() =', this.currentUser());
      console.log(this.currentUser()?.id);
      console.log('User =', user);
    });
  }


  resetSessionTimer() {
    this.subscription =
      fromEvent(document, 'mousemove')
        .subscribe(e => {
          clearTimeout(this.sessionTimer);
          // console.log('Reset Timout');
          this.startSessionTimer();
        });
  }


  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }


  startSessionTimer() {
    // this.subscription?.unsubscribe();
    // console.log('Start Timout');
    this.sessionTimer = setTimeout(() => {
      this.logout();
      this.subscription?.unsubscribe();
      alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    }, 900000); // logout after 15 minutes of inactivity 900000
  }


  async initializeAuthState() {
    this.authSubscription = user(this.auth).subscribe((authUser: AuthUser | null) => {
      if (authUser) {
        this.currentUserUid = authUser.uid;
        this.getFirestoreUserData(authUser.uid);
      } else {
        this.setUser(null);
      }
    });
  }

  getFirestoreUserData(authUserID: string) {
    if (authUserID) {
      const userDocRef = doc(this.firestore, `users/${authUserID}`);
      onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreUserData = docSnap.data() as User;
          // Hier wird die ID manuell hinzugefügt
          firestoreUserData.id = docSnap.id;  // ID hinzufügen
          const currentUserObject = this.setCurrentUserObject(firestoreUserData);
          this.setUser(currentUserObject);
        } else {
          console.log(`No Firestore User with id: ${authUserID} found`);
          this.setUser(null);
        }
      });
    } else {
      console.log(`No Firestore User with id: ${authUserID} found`);
      this.setUser(null);
    }
  }


  setUser(user: User | null | undefined) {
    this.userSignal.set(user);
    this.userUpdated.emit(user);
  }

  setCurrentUserObject(user: User): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarPath: user.avatarPath,
      loginState: 'loggedIn',
      channels: user.channels
    } as User;
  }


  getUserSignal() {
    return this.userSignal;
  }


  async login(email: string, password: string): Promise<void> {
    try {
      let result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      await this.userService.updateUserLoginState(result.user.uid, 'loggedIn');
      this.router.navigateByUrl('board');
    }
    catch (err: any) {
      throw err;
    }
  }



  async logout(): Promise<void> {
    if (this.auth.currentUser?.uid === 'ZnyRrhtuIBhdU3EYhDw5DueQsi02') {
      await this.resetGuestUserProfile();
      await this.resetGuestUserData();
    }
    try {
      if (this.auth.currentUser) {
        await this.userService.updateUserLoginState(this.auth.currentUser.uid, 'loggedOut');
        await signOut(this.auth);
        window.open('sign-in', '_self');
      }
      else {
        console.log('No user is currently logged in');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }


  async guestLogin(): Promise<void> {
    const guestEmail = 'guest@test.de';
    const guestPassword = 'guestUser';
    let result: UserCredential = await signInWithEmailAndPassword(this.auth, guestEmail, guestPassword);
    await this.userService.updateUserLoginState(result.user.uid, 'loggedIn');
  }


  async resetGuestUserData() {
    await this.deleteGuestData('direct_messages', 'senderId');
    await this.deleteGuestData('messages', 'senderID');
    await this.deleteGuestData('channels', 'channelAuthorId');
    await this.deleteGuestData('notes', 'noteAuthorId');
  }


  async deleteGuestData(firebaseCollection: string, filterField: string): Promise<void> {
    const q = query(collection(this.firestore, firebaseCollection), where(filterField, '==', this.auth.currentUser?.uid));
    const querySnapshot = await getDocs(q);

    // Iterate through the documents, get their IDs, and delete them
    for (const docSnap of querySnapshot.docs) {
      const docId = docSnap.id; // Get the document ID
      const docRef = doc(this.firestore, firebaseCollection, docId); // Create a reference to the document
      await deleteDoc(docRef); // Use the document reference to delete
      console.log(`Deleted document with ID: ${docId}`);
    }
  }


  async resetGuestUserProfile(): Promise<void> {
    let changes = {
      name: 'Gast',
      email: 'guest@test.de',
      avatarPath: './assets/images/avatars/avatar_default.png'
    };
    return this.userService.updateUserInFirestore(this.auth.currentUser!.uid, changes)
      .then(() => {
        this.updateUserProfile(changes);
      });
  }


  async updateUserProfile(changes: {}): Promise<void> {
    if (this.auth.currentUser) {
      await updateProfile(this.auth.currentUser, changes);
    }
  }

  async updateEmail(email: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        await verifyBeforeUpdateEmail(currentUser, email);
        alert('Email to confirm your new Email is send. This could take some Minutes');
        await this.logout();

      }
    } catch (err: any) {
      if (err.code == 'auth/requires-recent-login') {
        this.errorCode = err.code;
      } else {
        console.error('Error while updating auth user email', err.code);
        throw err;
      }
    }
  }


  async resetPassword(code: string, password: string): Promise<void> {
    try {
      await confirmPasswordReset(this.auth, code, password);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }


  async sendPasswordResetMail(mail: string): Promise<void> {
    try {
      const actionCodeSettings = { url: 'reset-password' };
      await sendPasswordResetEmail(this.auth, mail, actionCodeSettings);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }
}