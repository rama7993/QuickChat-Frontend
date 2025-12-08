import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SafeStorageService } from '../../../core/services/storage/safe-storage.service';

@Component({
  selector: 'app-login-success',
  imports: [CommonModule],
  templateUrl: './login-success.component.html',
  styleUrl: './login-success.component.scss',
})
export class LoginSuccessComponent implements OnInit, OnDestroy {
  private safeStorage = inject(SafeStorageService);
  private authService = inject(AuthService);
  private router = inject(Router);

  isRedirecting = false;
  countdown = 3;
  loadingMessage = 'Initializing your session...';

  private redirectTimeout: any;

  ngOnInit(): void {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (token) {
      this.safeStorage.set('authToken', token);
    }

    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        this.isRedirecting = true;
        this.loadingMessage = `Redirecting to chat in ${this.countdown}sec...`;

        this.redirectTimeout = setInterval(() => {
          this.countdown--;
          this.loadingMessage = `Redirecting to chat in ${this.countdown}sec...`;

          if (this.countdown <= 0) {
            clearInterval(this.redirectTimeout);
            this.router.navigate(['/chat']);
          }
        }, 1000);
      },
      error: () => {
        this.loadingMessage = 'Authentication failed. Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.redirectTimeout) {
      clearInterval(this.redirectTimeout);
    }
  }

  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
