import { inject, Injectable, signal, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { confirmPasswordReset, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, verifyBeforeUpdateEmail, getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { UserCredential } from "firebase/auth";
import { UserService } from '../../firestore/user-service/user.service';
import { Auth, user, User as AuthUser } from '@angular/fire/auth';
import { User } from '../../../models/user.class';
import { Subscription } from 'rxjs';
import { doc, Firestore, getDoc, getFirestore, onSnapshot, setDoc, updateDoc } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  auth = inject(Auth);
  router = inject(Router);
  userService = inject(UserService);
  private userSignal = signal<User | null | undefined>(undefined);
  private authSubscription: Subscription | null = null;
  errorCode: string | null = null
  currentUserUid: string | null | undefined = null;
  currentUser = this.getUserSignal(); // Change to hold an instance of the User class
  // GUEST_UID = 'RRRUP6BVCtgXTpni8cgrh9rW56D3';

  @Output() userUpdated: EventEmitter<User | null | undefined> = new EventEmitter();

  constructor(private firestore: Firestore) {
    this.initializeAuthState();
    this.userUpdated.subscribe((user) => {
      this.userService.setUser(user);
      console.log('auth.service.currentUser() =', this.currentUser());
      console.log(this.currentUser()?.id);
    });
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

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
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
    const guestPassword = 'gastuser';
    let result: UserCredential = await signInWithEmailAndPassword(this.auth, guestEmail, guestPassword);
    await this.userService.updateUserLoginState(result.user.uid, 'loggedIn');
  }


  // async guestLogin() {
  //   const db = getFirestore();
  //   const guestRef = doc(db, 'users', this.GUEST_UID);

  //   // Erstelle ein Gastbenutzer-Objekt mit setCurrentUserObject
  //   const guestUserObject = {
  //     uid: this.GUEST_UID,
  //     email: '', // Gastbenutzer haben normalerweise keine E-Mail
  //     name: 'Gast',
  //     avatarPath: './assets/images/avatars/avatar1.svg', // Hier kannst du einen Pfad zu einem Standard-Avatar setzen
  //     loginState: 'loggedOut',
  //     channels: [] // Optional: Falls der Gastbenutzer keine Kanäle haben soll, bleibt dies leer
  //   };

  //   // Überprüfen, ob der Gastbenutzer-Datensatz existiert
  //   const guestSnapshot = await getDoc(guestRef);
  //   if (!guestSnapshot.exists()) {
  //     // Falls kein Gastbenutzer existiert, neuen Gastbenutzer-Datensatz erstellen
  //     await setDoc(guestRef, guestUserObject);
  //     console.log('Gastbenutzer erstellt mit UID:', this.GUEST_UID);
  //   } else {
  //     console.log('Gastbenutzer existiert bereits mit UID:', this.GUEST_UID);

  //     // Falls der Gastbenutzer bereits existiert, den loginState auf 'loggedIn' ändern
  //     await updateDoc(guestRef, {
  //       loginState: 'loggedIn'
  //     });
  //     console.log('loginState auf "loggedIn" gesetzt');
  //   }

  //   // "Anmeldung" simulieren, indem du die UID speicherst
  //   // localStorage.setItem('guestUID', this.GUEST_UID);
  // }


  async updateUserProfile(changes: {}): Promise<void> {
    try {
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, changes);
      }
    } catch (err: any) {

      this.errorCode = err.code;
      console.error('Error while updating auth user profile', err.code);
      throw err;
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