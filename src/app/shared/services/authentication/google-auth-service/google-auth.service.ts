import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { UserService } from '../../firestore/user-service/user.service';


@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  auth = inject(Auth);
  router = inject(Router);
  provider = new GoogleAuthProvider();
  userService = inject(UserService);

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
        await this.userService.updateUserLoginState(result.user.uid, 'loggedIn')
          .then(() => {
            console.log('User successfully created /logged in, in Firestore');
          })
          .catch((error) => {
            console.error('Error creating user in Firestore:', error.message);
          });

        this.router.navigateByUrl('board');
        console.log('Logged in as:', result.user.displayName, result.user.email);
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
        this.router.navigateByUrl('board');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }
}