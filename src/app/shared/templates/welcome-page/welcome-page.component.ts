import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/authentication/auth-service/auth.service';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './welcome-page.component.html',
  styleUrls: ['../../../../styles.scss', './welcome-page.component.scss'],
})
export class WelcomePageComponent {

  constructor(public authService: AuthService) { }

}