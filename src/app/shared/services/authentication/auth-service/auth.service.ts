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
  private justLoggedIn: boolean = false; // Flag to track recent login
  private isLoggingOut: boolean = false; // Flag to track logout process
  private appStartTime: number = Date.now(); // Track when app started
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
    });
  }


  startSessionManagement(): void {
    this.resetSessionTimer();
  }

  
  markAsJustLoggedIn(): void {
    this.justLoggedIn = true;
  }


  resetSessionTimer() {
    this.subscription =
      fromEvent(document, 'mousemove')
        .subscribe(e => {
          clearTimeout(this.sessionTimer);
          this.startSessionTimer();
        });
  }


  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }


  /**
   * Handle browser/tab close events to update user login state
   * This method is called when user closes browser/tab without explicit logout
   */
  async handleBrowserClose(): Promise<void> {
    // Don't update login state if user just logged in or is in logout process
    if (this.justLoggedIn || this.isLoggingOut) {
      console.log('🔍 Skipping handleBrowserClose - user just logged in or logging out');
      return;
    }
    
    // Don't update login state if app just started (within 10 seconds)
    const timeSinceAppStart = Date.now() - this.appStartTime;
    if (timeSinceAppStart < 10000) {
      console.log('🔍 Skipping handleBrowserClose - app just started, likely page refresh');
      return;
    }
    
    if (this.auth.currentUser) {
      try {
        console.log('🚪 handleBrowserClose called - updating loginState to loggedOut');
        // Update loginState to 'loggedOut' in Firebase when browser/tab is closed
        await this.userService.updateUserLoginState(this.auth.currentUser.uid, 'loggedOut');
      } catch (error) {
        console.error('Error updating login state on browser close:', error);
      }
    }
  }


  startSessionTimer() {
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
      onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const firestoreUserData = docSnap.data() as User;
          // Hier wird die ID manuell hinzugefügt
          firestoreUserData.id = docSnap.id;  // ID hinzufügen
          
          console.log('🔍 Firestore Data:', {
            loginState: firestoreUserData.loginState,
            justLoggedIn: this.justLoggedIn,
            userId: firestoreUserData.id
          });
          
          // Check if user should be logged out due to loginState being 'loggedOut'
          if (firestoreUserData.loginState === 'loggedOut' && !this.justLoggedIn && !this.isLoggingOut) {
            console.log('🚪 LoginState is loggedOut - forcing logout and redirect to login');
            await this.forceLogoutAndRedirect();
            return;
          }
          
          // Only reset justLoggedIn flag if the Firestore data actually shows 'loggedIn'
          const shouldForceLoggedIn = this.justLoggedIn && firestoreUserData.loginState !== 'loggedIn';
          const currentUserObject = this.setCurrentUserObject(firestoreUserData, shouldForceLoggedIn);
          this.setUser(currentUserObject);
          
          // Reset the flag only when Firestore data is actually updated to 'loggedIn'
          if (this.justLoggedIn && firestoreUserData.loginState === 'loggedIn') {
            this.justLoggedIn = false;
            console.log('✅ Reset justLoggedIn flag - Firestore now shows loggedIn');
          }
        } else {
          this.setUser(null);
        }
      });
    } else {
      this.setUser(null);
    }
  }


  setUser(user: User | null | undefined) {
    this.userSignal.set(user);
    this.userUpdated.emit(user);
  }

  setCurrentUserObject(user: User, forceLoggedIn: boolean = false): User {
    // If user is authenticated in Firebase Auth but Firestore shows loggedOut,
    // and we're not in a logout process, assume they should be loggedIn
    const isFirebaseAuthenticated = !!this.auth.currentUser;
    const firestoreShowsLoggedOut = user.loginState === 'loggedOut';
    const shouldOverrideToLoggedIn = forceLoggedIn || (isFirebaseAuthenticated && firestoreShowsLoggedOut);
    
    const finalLoginState = shouldOverrideToLoggedIn ? 'loggedIn' : user.loginState;
    
    console.log('🔄 setCurrentUserObject:', {
      originalLoginState: user.loginState,
      forceLoggedIn,
      isFirebaseAuthenticated,
      shouldOverrideToLoggedIn,
      finalLoginState,
      userId: user.id
    });
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarPath: user.avatarPath,
      loginState: finalLoginState,
      channels: user.channels
    } as User;
  }


  getUserSignal() {
    return this.userSignal;
  }


  async login(email: string, password: string): Promise<void> {
    try {
      let result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('🚀 Login successful, setting justLoggedIn flag');
      this.justLoggedIn = true; // Set flag to force loginState to 'loggedIn'
      
      // Reset justLoggedIn flag after 5 seconds to prevent indefinite protection
      setTimeout(() => {
        this.justLoggedIn = false;
        console.log('⏰ Auto-reset justLoggedIn flag after timeout');
      }, 5000);
      
      // Wait for the loginState update to complete before proceeding
      console.log('⏳ Updating loginState to loggedIn...');
      await this.userService.updateUserLoginState(result.user.uid, 'loggedIn');
      console.log('✅ LoginState update completed');
      this.resetSessionTimer(); // Start session timer after successful login
      this.router.navigateByUrl('board');
    }
    catch (err: any) {
      throw err;
    }
  }



  async logout(): Promise<void> {
    this.isLoggingOut = true; // Set flag to prevent interference
    if (this.auth.currentUser?.uid === 'ZnyRrhtuIBhdU3EYhDw5DueQsi02') {
      await this.resetGuestUserProfile();
      await this.resetGuestUserData();
    }
    try {
      if (this.auth.currentUser) {
        await this.userService.updateUserLoginState(this.auth.currentUser.uid, 'loggedOut');
        // Clean up session timer and activity listener
        if (this.sessionTimer) {
          clearTimeout(this.sessionTimer);
          this.sessionTimer = null;
        }
        if (this.subscription) {
          this.subscription.unsubscribe();
          this.subscription = null;
        }
        await signOut(this.auth);
        this.isLoggingOut = false; // Reset flag
        window.open('sign-in', '_self');
      }
    } catch (err: any) {
      this.isLoggingOut = false; // Reset flag on error
      console.error(err);
      throw err;
    }
  }


  /**
   * Force logout and redirect when loginState is 'loggedOut' in Firestore
   * This ensures users are automatically logged out when their session is invalidated
   */
  async forceLogoutAndRedirect(): Promise<void> {
    console.log('🔒 Force logout triggered - loginState is loggedOut');
    this.isLoggingOut = true; // Set flag to prevent interference
    
    try {
      // Clean up session timer and activity listener
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = null;
      }
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = null;
      }
      
      // Sign out from Firebase Auth without updating Firestore (already loggedOut)
      await signOut(this.auth);
      
      // Reset flags
      this.isLoggingOut = false;
      this.justLoggedIn = false;
      
      // Redirect to login page
      this.router.navigate(['/sign-in']);
      
      console.log('✅ Force logout completed - redirected to login page');
    } catch (err: any) {
      this.isLoggingOut = false; // Reset flag on error
      console.error('Error during force logout:', err);
      // Even if there's an error, still redirect to login page
      this.router.navigate(['/sign-in']);
    }
  }


  async guestLogin(): Promise<void> {
    const guestEmail = 'guest@test.de';
    const guestPassword = 'guestUser';
    let result: UserCredential = await signInWithEmailAndPassword(this.auth, guestEmail, guestPassword);
    this.justLoggedIn = true; // Set flag to force loginState to 'loggedIn'
    await this.userService.updateUserLoginState(result.user.uid, 'loggedIn');
    this.resetSessionTimer(); // Start session timer after successful guest login
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