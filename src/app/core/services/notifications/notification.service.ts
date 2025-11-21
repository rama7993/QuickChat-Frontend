import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Notification,
  NotificationResponse,
  NotificationSettings,
} from '../../interfaces/notification.model';
import { SocketService } from '../socket/socket.service';
import { SoundNotificationService } from './sound-notification.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private apiUrl = environment.apiUrl;
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private socketService = inject(SocketService);
  private soundService = inject(SoundNotificationService);

  constructor(private http: HttpClient) {
    this.listenForRealtimeNotifications();
  }

  // Get notifications with pagination
  getNotifications(
    page: number = 1,
    limit: number = 20,
    type?: string,
    read?: boolean
  ): Observable<NotificationResponse> {
    let params: any = { page: page.toString(), limit: limit.toString() };
    if (type) params.type = type;
    if (read !== undefined) params.read = read.toString();

    return this.http
      .get<NotificationResponse>(`${this.apiUrl}/notifications`, {
        params,
      })
      .pipe(
        tap((response) => {
          this.syncNotifications(response.notifications || []);
          if (typeof response.unreadCount === 'number') {
            this.updateUnreadCount(response.unreadCount);
          }
        })
      );
  }

  // Get unread notifications count
  getUnreadCount(): Observable<{ count: number }> {
    return this.http
      .get<{ count: number }>(`${this.apiUrl}/notifications/unread-count`)
      .pipe(
        tap((response) => {
          this.updateUnreadCount(response.count);
        })
      );
  }

  // Update unread count
  updateUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  // Sync notifications cache
  syncNotifications(notifications: Notification[]): void {
    const sorted = [...notifications].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.notificationsSubject.next(sorted);
    const unread = sorted.filter((n) => !n.read).length;
    this.unreadCountSubject.next(unread);
  }

  // Mark notification as read
  markAsRead(notificationId: string): Observable<Notification> {
    return this.http.put<Notification>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {}
    );
  }

  // Mark all notifications as read
  markAllAsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/notifications/mark-all-read`,
      {}
    );
  }

  // Delete notification
  deleteNotification(notificationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/notifications/${notificationId}`
    );
  }

  // Delete all notifications
  deleteAllNotifications(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/notifications`
    );
  }

  // Get notification settings
  getNotificationSettings(): Observable<NotificationSettings> {
    return this.http.get<NotificationSettings>(
      `${this.apiUrl}/notifications/settings`
    );
  }

  // Update notification settings
  updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Observable<NotificationSettings> {
    return this.http.put<NotificationSettings>(
      `${this.apiUrl}/notifications/settings`,
      { notificationSettings: settings }
    );
  }

  // Format notification message
  formatNotificationMessage(notification: Notification): string {
    switch (notification.type) {
      case 'message':
        return `New message from ${notification.data.senderId?.firstName} ${notification.data.senderId?.lastName}`;
      case 'group_message':
        return `New message in ${notification.data.groupId?.name}`;
      case 'group_invite':
        return `You've been added to ${notification.data.groupId?.name}`;
      case 'friend_request':
        return `Friend request from ${notification.data.senderId?.firstName} ${notification.data.senderId?.lastName}`;
      case 'message_reaction':
        return `${notification.data.senderId?.firstName} reacted to your message`;
      case 'message_reply':
        return `${notification.data.senderId?.firstName} replied to your message`;
      case 'group_admin':
        return `You've been made admin of ${notification.data.groupId?.name}`;
      default:
        return notification.message;
    }
  }

  // Get notification icon
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return 'pi pi-comment';
      case 'group_message':
        return 'pi pi-users';
      case 'group_invite':
        return 'pi pi-user-plus';
      case 'friend_request':
        return 'pi pi-user';
      case 'message_reaction':
        return 'pi pi-heart';
      case 'message_reply':
        return 'pi pi-reply';
      case 'group_admin':
        return 'pi pi-crown';
      case 'system':
        return 'pi pi-info-circle';
      default:
        return 'pi pi-bell';
    }
  }

  // Get notification priority color
  getNotificationPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-blue-500';
      case 'low':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  }

  private listenForRealtimeNotifications(): void {
    this.socketService.notification$.subscribe((notification) => {
      if (notification) {
        this.handleIncomingNotification(notification as Notification);
      }
    });
  }

  private handleIncomingNotification(notification: Notification): void {
    const current = this.notificationsSubject.value;
    const exists = current.some((n) => n._id === notification._id);
    const updated = exists ? current : [notification, ...current].slice(0, 100);
    this.syncNotifications(updated);

    const soundType =
      notification.type === 'group_message'
        ? 'group'
        : notification.type === 'system'
        ? 'system'
        : 'message';
    this.soundService.playNotificationSound(soundType as any);
  }
}
