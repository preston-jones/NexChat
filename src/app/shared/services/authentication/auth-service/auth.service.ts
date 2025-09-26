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
    // Extended protection period to handle slow Firestore updates
    setTimeout(() => {
      this.justLoggedIn = false;
    }, 15000); // Increased from 5 to 15 seconds
  }


  resetSessionTimer() {
    // Clean up existing subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    // Listen to multiple activity types to better capture user interaction
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const resetTimer = () => {
      clearTimeout(this.sessionTimer);
      this.startSessionTimer();
    };
    
    // Use the first event for RxJS subscription (mousemove is most frequent)
    this.subscription = fromEvent(document, 'mousemove').subscribe(resetTimer);
    
    // Add additional event listeners for better activity detection
    activityEvents.slice(1).forEach(eventType => {
      document.addEventListener(eventType, resetTimer, { passive: true });
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
      return;
    }
    
    // Extended protection window to prevent race conditions during navigation
    const timeSinceAppStart = Date.now() - this.appStartTime;
    if (timeSinceAppStart < 30000) { // Increased from 10 to 30 seconds
      console.log('🔍 Skipping handleBrowserClose - app recently started, likely navigation/refresh');
      return;
    }
    
    // Additional check: don't update if we're in the middle of authentication flow
    if (window.location.pathname.includes('/sign-in') || 
        window.location.pathname.includes('/create-account') || 
        window.location.pathname.includes('/reset-password')) {
      console.log('🔍 Skipping handleBrowserClose - in authentication flow');
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
      // Don't show alert for automatic forced logout - user is already being redirected
      this.logout();
      this.subscription?.unsubscribe();
      // Only show alert if this is a genuine session timeout, not a forced logout
      if (!this.isLoggingOut) {
        alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
      }
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
        // If we're already in the process of logging out, don't process further
        if (this.isLoggingOut) {
          console.log('🚫 Skipping Firestore data processing - already logging out');
          return;
        }
        
        if (docSnap.exists()) {
          const firestoreUserData = docSnap.data() as User;
          // Hier wird die ID manuell hinzugefügt
          firestoreUserData.id = docSnap.id;  // ID hinzufügen
          
          console.log('🔍 Firestore Data:', {
            loginState: firestoreUserData.loginState,
            justLoggedIn: this.justLoggedIn,
            isLoggingOut: this.isLoggingOut,
            userId: firestoreUserData.id
          });
          
          // Check if user should be logged out due to loginState being 'loggedOut'
          // Only trigger forced logout if:
          // 1. loginState is 'loggedOut' 
          // 2. User didn't just log in
          // 3. We're not already in the logout process
          // 4. Firebase Auth still shows user as authenticated (to prevent loops)
          if (firestoreUserData.loginState === 'loggedOut' && 
              !this.justLoggedIn && 
              !this.isLoggingOut && 
              this.auth.currentUser) {
            console.log('️ Debug timing info:', {
              timeSinceAppStart: Date.now() - this.appStartTime,
              justLoggedIn: this.justLoggedIn,
              isLoggingOut: this.isLoggingOut,
              currentPath: window.location.pathname,
              firestoreLoginState: firestoreUserData.loginState
            });
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
          }
        } else {
          // If user document doesn't exist and we're not logging out, set user to null
          if (!this.isLoggingOut) {
            this.setUser(null);
          }
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
      this.justLoggedIn = true; // Set flag to force loginState to 'loggedIn'
      
      // Wait for the loginState update to complete before proceeding
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
      
      // Clear the user state immediately to prevent further processing
      this.setUser(null);
      
      // Sign out from Firebase Auth without updating Firestore (already loggedOut)
      await signOut(this.auth);
      console.log('🔓 Firebase signOut completed');
      
      // Reset flags after successful signOut
      this.justLoggedIn = false;
      
      // Use immediate redirect instead of setTimeout to prevent race conditions
      console.log('🔄 Redirecting to login page...');
      window.location.href = '/sign-in';
      
    } catch (err: any) {
      console.error('Error during force logout:', err);
      // Even if there's an error, still redirect to login page immediately
      this.isLoggingOut = false; // Reset flag on error
      window.location.href = '/sign-in';
    }
    
    // Note: Don't reset isLoggingOut here as the page will be redirected anyway
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