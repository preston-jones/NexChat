import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideFirebaseApp(() => initializeApp(
    {
      "projectId": "dabubble-effe4",
      "appId": "1:196287678984:web:2cacacbd1afc34770e5fbd",
      "storageBucket": "dabubble-effe4.appspot.com",
      "apiKey": "AIzaSyAhhcc0m188sSIG68UZkzVj0o4PsCSDY0g",
      "authDomain": "dabubble-effe4.firebaseapp.com",
      "messagingSenderId": "196287678984"
    })), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideMessaging(() => getMessaging()), provideStorage(() => getStorage()), provideAnimationsAsync()]
};
