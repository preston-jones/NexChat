import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AvatarsService {

  avatars = [
    './assets/images/avatars/avatar1.svg',
    './assets/images/avatars/avatar2.svg',
    './assets/images/avatars/avatar3.svg',
    './assets/images/avatars/avatar4.svg',
    './assets/images/avatars/avatar5.svg',
    './assets/images/avatars/avatar6.svg',
  ];

  getAvatars() {
    return this.avatars;
  }

}
