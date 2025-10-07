import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notifications/notification.service';
import { NotificationResponse, Notification } from '../../../core/interfaces/notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  public notifications = signal<Notification[]>([]);
  public unreadCount = signal(0);
  public isLoading = signal(false);

  private subscriptions: Subscription[] = [];
  private notificationService = inject(NotificationService);

  ngOnInit() {
    this.loadNotifications();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadNotifications() {
    this.isLoading.set(true);
    
    // Load notifications from the notification service
    this.notificationService.getNotifications().subscribe({
      next: (response: NotificationResponse) => {
        this.notifications.set(response.notifications || []);
        this.updateUnreadCount();
        this.isLoading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.notifications.set([]);
        this.updateUnreadCount();
        this.isLoading.set(false);
      }
    });
  }

  private updateUnreadCount() {
    const unread = this.notifications().filter(n => !n.read).length;
    this.unreadCount.set(unread);
  }

  markAsRead(notification: Notification) {
    if (!notification.read) {
      this.notificationService.markAsRead(notification._id).subscribe({
        next: () => {
          const updatedNotifications = this.notifications().map(n => 
            n._id === notification._id ? { ...n, read: true } : n
          );
          this.notifications.set(updatedNotifications);
          this.updateUnreadCount();
        },
        error: (error: any) => {
          console.error('Error marking notification as read:', error);
        }
      });
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        const updatedNotifications = this.notifications().map(n => ({ ...n, read: true }));
        this.notifications.set(updatedNotifications);
        this.updateUnreadCount();
      },
      error: (error: any) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  deleteNotification(notification: Notification) {
    this.notificationService.deleteNotification(notification._id).subscribe({
      next: () => {
        const updatedNotifications = this.notifications().filter(n => n._id !== notification._id);
        this.notifications.set(updatedNotifications);
        this.updateUnreadCount();
      },
      error: (error: any) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  clearAllNotifications() {
    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        this.notifications.set([]);
        this.updateUnreadCount();
      },
      error: (error: any) => {
        console.error('Error clearing all notifications:', error);
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message': return 'pi pi-comment';
      case 'group_invite': return 'pi pi-users';
      case 'system': return 'pi pi-info-circle';
      case 'call': return 'pi pi-phone';
      default: return 'pi pi-bell';
    }
  }

  getNotificationClass(type: string): string {
    switch (type) {
      case 'message': return 'notification-message';
      case 'group_invite': return 'notification-group';
      case 'system': return 'notification-system';
      case 'call': return 'notification-call';
      default: return 'notification-default';
    }
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  }
}
