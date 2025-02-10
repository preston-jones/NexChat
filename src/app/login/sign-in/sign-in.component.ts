import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators, FormsModule, ReactiveFormsModule, } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterModule } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';

import { GoogleAuthService } from '../../shared/services/authentication/google-auth-service/google-auth.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
/* ------------------------- */

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
  }
}

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonModule,
    RouterModule,
    MatDividerModule,
  ],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss', './../../../styles.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SignInComponent {

  googleAuthService = inject(GoogleAuthService);
  authService = inject(AuthService);
  router = inject(Router);

  emailFormControl = new FormControl('', [Validators.required, Validators.email]);
  passwordFormControl = new FormControl('', [Validators.required]);
  nameFormControl = new FormControl('', [Validators.required]);
  checkboxFormControl = new FormControl(false, [Validators.requiredTrue]);
  formSubmitted = false;
  passwordVisible: boolean = false;
  loginError = false;

  matcher: MyErrorStateMatcher = new MyErrorStateMatcher();


  async googleLogin(): Promise<void> {
    try {
      await this.googleAuthService.googlePopupLogin();
      this.router.navigateByUrl('board');
    }
    catch (error) {
      console.error('Google login error:', error);
    }
  }


  async guestLogin(): Promise<void> {
    try {
      await this.authService.guestLogin();
      this.router.navigateByUrl('board');
    }
    catch (error) {
      console.error('Google login error:', error);
    }
  }

  resetPassword(): void {
    this.router.navigateByUrl('send-mail');
  }

  async emailLogin(email: string, password: string): Promise<void> {
    if (this.emailFormControl.valid && this.passwordFormControl.valid) {
      try {
        await this.authService.login(email, password);
      }
      catch (error) {
        console.error('Login error:', error);
        this.loginError = true;
      }
    }
    else {
      console.error('Invalid form');
    }
  }

  showPassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }
}