import { Component, inject, signal, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AvatarModule } from 'primeng/avatar';
import { Default_Img_Url } from '../../../../utils/constants.utils';
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, AvatarModule, ThemeSelectorComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  
  showUserMenu = false;
  showSearch = false;
  searchQuery = '';
  unreadCount = 3; // This would come from a notification service
  currentUser = this.authService.currentUser;
  defaultAvatar = Default_Img_Url;

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
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
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
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
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
