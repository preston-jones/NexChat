import { Component, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './legal-notice.component.html',
  styleUrl: './legal-notice.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class LegalNoticeComponent {
  constructor(private _location: Location) { }
  goBack() {
    this._location.back();
  }
}
