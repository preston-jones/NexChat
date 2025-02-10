import { NgClass, NgFor, NgStyle } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';
import { AvatarsService } from '../../../shared/services/avatars/avatars.service';
import { CreateAccountComponent } from '../create-account.component';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../../../shared/services/firestore/user-service/user.service';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

@Component({
  selector: 'app-select-avatar',
  standalone: true,
  imports: [MatCardModule, NgFor, MatButtonModule, NgClass, NgStyle, MatIconModule, CreateAccountComponent],
  templateUrl: './select-avatar.component.html',
  styleUrl: './select-avatar.component.scss',
  encapsulation: ViewEncapsulation.None
})

export class SelectAvatarComponent implements OnInit {
  userName: string = '';
  avatars: string[] = [];
  selectedAvatar: string | null = null;
  avatarSelected = false;


  constructor(private _location: Location, private avatarsService: AvatarsService, private auth: Auth, private userService: UserService, private router: Router) {
    this.loadAvatars();
    this.shuffleAvatars();
  }

  async loadAvatars() {
    this.avatars = await this.avatarsService.getAvatars();
  }

  ngOnInit(): void {

  }

  chooseAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.avatarSelected = true;
  }

  shuffleAvatars() {
    for (let i = this.avatars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.avatars[i], this.avatars[j]] = [this.avatars[j], this.avatars[i]];
    }
  }

  goBack() {
    this._location.back();
  }

  finishCreateAccount() {
    const user = this.auth.currentUser;

    if (user && this.selectedAvatar) {
      const firestoreUser = {
        avatarPath: this.selectedAvatar,
      };

      this.userService.updateUserInFirestore(user.uid, firestoreUser)
        .then(() => {
          this.router.navigate(['sign-in']);
        })
        .catch((error) => {
          console.error('Error updating avatar in Firestore:', error.message);
        });
    } else {
      console.error('No user is logged in or avatar not selected');
    }
  }

  uploadAvatar(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];

    if (file && allowedTypes.includes(file.type)) {
      const storage = getStorage();
      const avatarRef = ref(storage, `avatar_images/custom/${new Date().getTime()}_${file.name}`);

      uploadBytes(avatarRef, file).then(() => {
        console.log('Upload successful!');
        return getDownloadURL(avatarRef);
      }).then((downloadURL) => {
        console.log('File available at', downloadURL);
        this.selectedAvatar = downloadURL;
      }).catch((error) => {
        console.error('Upload failed', error);
      });
    } else {
      console.error('File type not supported');
    }
  }

}
