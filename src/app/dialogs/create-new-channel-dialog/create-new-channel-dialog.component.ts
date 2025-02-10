import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { IconsService } from '../../shared/services/icons/icons.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { AddPeopleDialog } from './add-people-dialog/add-people-dialog.component';
import { User } from '../../shared/models/user.class';

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-create-new-channel-dialog',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
],
  templateUrl: './create-new-channel-dialog.component.html',
  styleUrl: './create-new-channel-dialog.component.scss',
  encapsulation: ViewEncapsulation.None
  
})
export class CreateNewChannelDialog implements OnInit {

  newChannelName: string = '';
  newChannelDescription: string = '';

  constructor(
    private iconsService: IconsService, 
    // private channelsService: ChannelsService,
    private dialogRef: MatDialogRef<CreateNewChannelDialog>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public users: [],
    @Inject(MAT_DIALOG_DATA) public currentUser: User,
  ) { }
  ngOnInit(): void {
    // console.log('User sind:', this.users);
  }

  nameFormControl = new FormControl('', [Validators.required]);
  matcher: MyErrorStateMatcher = new MyErrorStateMatcher();
  formSubmitted = false;

  // Method to validate the form, open new dialog and rending data to the new dialog
  openNextDialog() {
    this.formSubmitted = true; 
  
    this.dialog.open(AddPeopleDialog, {
      data: {
        name: this.newChannelName,
        description: this.newChannelDescription,
      }
    });

    this.clearInputs();
    this.dialogRef.close();
  }

  // Method to clear the input fields
  clearInputs() {
    this.newChannelName = '';
    this.newChannelDescription = '';
}

  // Method to check if the form is valid
  isValid(): boolean {
    return this.newChannelName.trim().length > 0;
  }
}
