import {
  Component,
  inject,
  signal,
  HostListener,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/notifications/notification.service';
import { SocketService } from '../../../core/services/socket/socket.service';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { AvatarModule } from 'primeng/avatar';
import { Default_Img_Url } from '../../../../utils/constants.utils';
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';
import { ConnectionStatusComponent } from '../../../shared/components/connection-status/connection-status.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    FormsModule,
    AvatarModule,
    ThemeSelectorComponent,
    ConnectionStatusComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private socketService = inject(SocketService);
  private logger = inject(LoggerService);

  private subscriptions: Subscription[] = [];

  showUserMenu = false;
  showSearch = false;
  searchQuery = '';
  unreadCount = signal(0);
  currentUser = this.authService.currentUser;
  defaultAvatar = Default_Img_Url;

  ngOnInit(): void {
    this.loadUnreadCount();
    this.subscribeToUnreadCount();
    this.subscribeToSocketNotifications();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadUnreadCount(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadCount.set(response.count);
        this.notificationService.updateUnreadCount(response.count);
      },
      error: (error) => {
        this.logger.error('Error loading unread count', error);
      },
    });
  }

  private subscribeToUnreadCount(): void {
    const sub = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount.set(count);
    });
    this.subscriptions.push(sub);
  }

  private subscribeToSocketNotifications(): void {
    const sub = this.socketService.notification$.subscribe((notification) => {
      if (notification) {
        // Refresh unread count when new notification arrives
        this.loadUnreadCount();
      }
    });
    this.subscriptions.push(sub);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.header__profile') && !target.closest('.user-menu')) {
      this.showUserMenu = false;
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  navTo(url: string): void {
    this.showUserMenu = false;
    this.router.navigate([url]);
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
    this.router.navigate(['/login']);
  }

  // Search functionality
  toggleSearch(): void {
    this.showSearch = !this.showSearch;
    if (this.showSearch) {
      // Focus the search input
      setTimeout(() => {
        const searchInput = document.querySelector(
          '.search-input'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }

  onSearchBlur(): void {
    // Delay hiding search to allow for clicking on results
    setTimeout(() => {
      if (!this.searchQuery.trim()) {
        this.showSearch = false;
      }
    }, 200);
  }

  performSearch(): void {
    if (this.searchQuery.trim()) {
      // Navigate to search results or perform search
      this.router.navigate(['/search'], {
        queryParams: { q: this.searchQuery },
      });
      this.showSearch = false;
    }
  }

  // Notification functionality
  toggleNotifications(): void {
    // Navigate to notifications page
    this.router.navigate(['/notifications']);
  }

  // Create group functionality
  createGroup(): void {
    this.router.navigate(['/create-group']);
  }
}
