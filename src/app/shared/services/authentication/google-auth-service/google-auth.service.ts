import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { UserService } from '../../firestore/user-service/user.service';
import { AuthService } from '../auth-service/auth.service';


@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  auth = inject(Auth);
  router = inject(Router);
  provider = new GoogleAuthProvider();
  userService = inject(UserService);
  authService = inject(AuthService);

  constructor() { }

  async googleLogin(): Promise<void> {
    try {
      await signInWithRedirect(this.auth, this.provider);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }

  async googlePopupLogin(): Promise<void> {
    try {
      const result = await signInWithPopup(this.auth, this.provider);
      if (result.user) {        
        const firestoreUser = {
          uid: result.user.uid,
          email: result.user.email,
          name: result.user.displayName || 'No Name',
          avatarPath: result.user.photoURL || null,
        };

        await this.userService.createFirestoreUser(firestoreUser)
        this.authService.markAsJustLoggedIn(); // Set flag before updating login state
        await this.userService.updateUserLoginState(result.user.uid, 'loggedIn')
          .then(() => {
            this.authService.startSessionManagement(); // Start session timer after Google login
          })
          .catch((error) => {
            console.error('Error creating user in Firestore:', error.message);
          });

        this.router.navigateByUrl('board');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }


  async getRedirectIntel(): Promise<void> {
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        this.authService.markAsJustLoggedIn(); // Set flag for redirect login
        this.authService.startSessionManagement(); // Start session timer after redirect login
        this.router.navigateByUrl('board');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }
}