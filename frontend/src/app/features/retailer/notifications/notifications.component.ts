import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification.model';

@Component({ selector: 'app-retailer-notifications', standalone: true, imports: [DatePipe, EmptyStateComponent], templateUrl: './notifications.component.html', styleUrl: './notifications.component.css' })
export class RetailerNotificationsComponent implements OnInit {
  readonly notifications = signal<Notification[]>([]); readonly loading = signal(true);
  constructor(private readonly service: NotificationService) {}
  ngOnInit(): void { this.load(); }
  load(): void { this.loading.set(true); this.service.mine().subscribe({ next: list => { this.notifications.set(list.sort((a,b)=>b.sentAt.localeCompare(a.sentAt))); this.loading.set(false); }, error:()=>this.loading.set(false) }); }
  markRead(item: Notification): void { if(item.read) return; this.service.markRead(item.notificationId).subscribe({next:()=>this.load(),error:()=>{}}); }
}
