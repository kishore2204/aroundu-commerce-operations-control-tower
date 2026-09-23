import { Component } from '@angular/core';
import { MyTicketsComponent } from '../../../shared/support/my-tickets.component';

@Component({
  selector: 'app-user-support', standalone: true, imports: [MyTicketsComponent],
  templateUrl: './user-support.component.html', styleUrl: './user-support.component.css',
})
export class UserSupportComponent {}
