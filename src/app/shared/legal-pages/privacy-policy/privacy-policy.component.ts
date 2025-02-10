import { Component, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class PrivacyPolicyComponent {
  constructor(private _location: Location) { }
  goBack() {
    this._location.back();
  }
}
