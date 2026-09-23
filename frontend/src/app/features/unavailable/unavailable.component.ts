import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unavailable',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './unavailable.component.html',
  styleUrl: './unavailable.component.css',
})
export class UnavailableComponent {}
