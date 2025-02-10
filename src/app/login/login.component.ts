import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CreateAccountComponent } from './create-account/create-account.component';
import { SignInComponent } from "./sign-in/sign-in.component";
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SelectAvatarComponent } from './create-account/select-avatar/select-avatar.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatButtonModule,
    RouterModule,
    CreateAccountComponent,
    SignInComponent,
    MatCardModule,
    MatIconModule,
    SelectAvatarComponent,
    CommonModule
  ],
  templateUrl: './login.component.html',
  styleUrls: [
    './login.component.scss',
    './login-animation.scss',
    './../../styles.scss'
  ]
})
export class LoginComponent {
  isCreateAccountPage = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Überprüfe die aktuelle URL direkt beim Laden der Seite
    this.isCreateAccountPage = this.router.url === '/create-account';

    // Überwache Router-Ereignisse für Navigationen
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isCreateAccountPage = event.url === '/create-account';
      }
    });
  }

}
