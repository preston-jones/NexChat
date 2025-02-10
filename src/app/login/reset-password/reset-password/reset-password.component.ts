import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Location } from '@angular/common';

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ResetPasswordComponent {
  constructor(private _location: Location) { }

  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.pattern('(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}')
  ]);
  confirmPasswordFormControl = new FormControl('', [Validators.required]);
  matcher = new MyErrorStateMatcher();
  passwordVisible = false;
  confirmPasswordVisible = false;

  isButtonDisabled(): boolean {
    const passwordValue = this.passwordFormControl.value;
    const confirmPasswordValue = this.confirmPasswordFormControl.value;

    return this.passwordFormControl.invalid ||
      this.confirmPasswordFormControl.invalid ||
      passwordValue !== confirmPasswordValue;
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.passwordVisible = !this.passwordVisible;
    } else if (field === 'confirmPassword') {
      this.confirmPasswordVisible = !this.confirmPasswordVisible;
    }
  }

  getConfirmPasswordError(): string | null {
    if (this.confirmPasswordFormControl.hasError('required')) {
      return 'Bitte bestätigen Sie Ihr Passwort.';
    }
    else (this.passwordFormControl.value !== this.confirmPasswordFormControl.value)
    return 'Die Passwörter stimmen nicht überein.';
  }

  goBack() {
    this._location.back();
  }
}
