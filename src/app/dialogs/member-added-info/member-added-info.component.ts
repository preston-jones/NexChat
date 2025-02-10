import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-member-added-info',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './member-added-info.component.html',
  styleUrl: './member-added-info.component.scss'
})
export class MemberAddedInfoComponent {

}
