import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideFirebaseApp(() => initializeApp(
    {
      apiKey: "AIzaSyDAIw2YomtecMPlk9_YMS0bklxmBoRtRkU",
      authDomain: "chatapp-7ec46.firebaseapp.com",
      projectId: "chatapp-7ec46",
      storageBucket: "chatapp-7ec46.firebasestorage.app",
      messagingSenderId: "796091978227",
      appId: "1:796091978227:web:128f4508ae11ee43b94286",
      measurementId: "G-ZHJXNVCG07"
    })), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideMessaging(() => getMessaging()), provideStorage(() => getStorage()), provideAnimationsAsync()]
};
