import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomSnackbarComponent } from '../../../dialogs/custom-snackbar/custom-snackbar.component';

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-send-email',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, ReactiveFormsModule, RouterModule],
  templateUrl: './send-email.component.html',
  styleUrls: ['./send-email.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class SendEmailComponent implements OnInit {
  constructor(private _location: Location, private auth: Auth, private snackBar: MatSnackBar,) { }


  emailFormControl = new FormControl('', [Validators.required, Validators.email]);
  matcher: MyErrorStateMatcher = new MyErrorStateMatcher();

  ngOnInit(): void {
    // this.snackBar.openFromComponent(CustomSnackbarComponent, {
    //   duration: 2000, // 2 Sekunden
    //   panelClass: ['custom-snackbar'],
    //   horizontalPosition: 'center', // 'start', 'center', 'end', 'left', 'right'
    //   verticalPosition: 'top',
    // });

  }

  isButtonDisabled(): boolean {
    const control = this.emailFormControl as FormControl;
    return control.invalid || control.value?.trim() === '';
  }

  sendPasswordResetEmail(event: Event) {
    // Verhindere Standard-Submit-Verhalten
    event.preventDefault();
    const email = this.emailFormControl.value;

    if (email) {
      from(sendPasswordResetEmail(this.auth, email)).pipe(
        map(() => {

          this.snackBar.openFromComponent(CustomSnackbarComponent, {
            // duration: 3000, // 3 Sekunden
            panelClass: ['custom-snackbar'],
            horizontalPosition: 'center', // 'start', 'center', 'end', 'left', 'right'
            verticalPosition: 'top',
          });
          this.emailFormControl.reset();
        }),
        catchError((error) => {
          console.error('Fehler beim Senden der E-Mail:', error);
          // alert('Fehler beim Senden der E-Mail: ' + error.message);
          return of(null);
        })
      ).subscribe();
    } else {
      // alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    }
  }


  goBack() {
    this._location.back();
  }
}
