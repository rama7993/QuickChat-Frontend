import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notifications/notification.service';
import { Notification } from '../../../core/interfaces/notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit, OnDestroy {
  public notifications = signal<Notification[]>([]);
  public searchTerm = signal('');
  public activeFilter = signal<
    'all' | 'unread' | 'message' | 'group_message' | 'system'
  >('all');
  public isLoading = signal(false);
  public unreadCount = signal(0);

  private subscriptions: Subscription[] = [];
  private notificationService = inject(NotificationService);

  public filteredNotifications = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const filter = this.activeFilter();
    return this.notifications()
      .filter((notification) => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !notification.read;
        return notification.type === filter;
      })
      .filter((notification) => {
        if (!term) return true;
        const haystack =
          `${notification.title} ${notification.message}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  });

  public stats = computed(() => {
    const all = this.notifications();
    const unread = all.filter((n) => !n.read).length;
    const direct = all.filter((n) => n.type === 'message').length;
    const system = all.filter((n) => n.type === 'system').length;
    return { total: all.length, unread, direct, system };
  });

  public filterOptions = [
    { label: 'All', value: 'all' as const },
    { label: 'Unread', value: 'unread' as const },
    { label: 'Direct', value: 'message' as const },
    { label: 'Groups', value: 'group_message' as const },
    { label: 'System', value: 'system' as const },
  ];

  ngOnInit() {
    this.observeNotifications();
    this.observeUnreadCount();
    this.loadNotifications();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadNotifications() {
    this.isLoading.set(true);

    // Load notifications from the notification service
    this.notificationService.getNotifications().subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.notificationService.syncNotifications([]);
        this.isLoading.set(false);
      },
    });
  }

  private observeNotifications() {
    const sub = this.notificationService.notifications$.subscribe(
      (notifications) => {
        this.notifications.set(notifications);
      }
    );
    this.subscriptions.push(sub);
  }

  private observeUnreadCount() {
    const sub = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount.set(count);
    });
    this.subscriptions.push(sub);
  }

  markAsRead(notification: Notification) {
    if (!notification.read) {
      this.notificationService.markAsRead(notification._id).subscribe({
        next: () => {
          const updatedNotifications = this.notifications().map((n) =>
            n._id === notification._id ? { ...n, read: true } : n
          );
          this.notificationService.syncNotifications(updatedNotifications);
        },
        error: (error: any) => {
          console.error('Error marking notification as read:', error);
        },
      });
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        const updatedNotifications = this.notifications().map((n) => ({
          ...n,
          read: true,
        }));
        this.notificationService.syncNotifications(updatedNotifications);
      },
      error: (error: any) => {
        console.error('Error marking all notifications as read:', error);
      },
    });
  }

  deleteNotification(notification: Notification) {
    this.notificationService.deleteNotification(notification._id).subscribe({
      next: () => {
        const updatedNotifications = this.notifications().filter(
          (n) => n._id !== notification._id
        );
        this.notificationService.syncNotifications(updatedNotifications);
      },
      error: (error: any) => {
        console.error('Error deleting notification:', error);
      },
    });
  }

  clearAllNotifications() {
    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        this.notificationService.syncNotifications([]);
      },
      error: (error: any) => {
        console.error('Error clearing all notifications:', error);
      },
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return 'pi pi-comment';
      case 'group_invite':
        return 'pi pi-users';
      case 'system':
        return 'pi pi-info-circle';
      case 'call':
        return 'pi pi-phone';
      default:
        return 'pi pi-bell';
    }
  }

  getNotificationClass(type: string): string {
    switch (type) {
      case 'message':
        return 'notification-message';
      case 'group_invite':
      case 'group_message':
        return 'notification-group';
      case 'system':
        return 'notification-system';
      case 'call':
        return 'notification-call';
      default:
        return 'notification-default';
    }
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  setFilter(filter: 'all' | 'unread' | 'message' | 'group_message' | 'system') {
    this.activeFilter.set(filter);
  }

  refresh() {
    this.loadNotifications();
  }

  trackById(_index: number, notification: Notification) {
    return notification._id;
  }
}
