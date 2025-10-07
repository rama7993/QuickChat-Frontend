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

  // Animation properties
  particles = Array(12).fill(0);
  progress = 0;
  isRedirecting = false;
  loadingMessage = 'Initializing your session...';

  private progressInterval: any;
  private messageInterval: any;
  private redirectTimeout: any;

  ngOnInit(): void {
    this.startProgressAnimation();
    this.startMessageRotation();

    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (token) {
      this.safeStorage.set('authToken', token);
    }

    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        this.isRedirecting = true;
        this.loadingMessage = 'Redirecting to chat...';
        this.redirectTimeout = setTimeout(
          () => this.router.navigate(['/chat']),
          3000
        );
      },
      error: () => {
        this.loadingMessage = 'Authentication failed. Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
    }
  }

  private startProgressAnimation(): void {
    this.progressInterval = setInterval(() => {
      if (this.progress < 100) {
        this.progress += Math.random() * 15;
        if (this.progress > 100) {
          this.progress = 100;
        }
      }
    }, 200);
  }

  private startMessageRotation(): void {
    const messages = [
      'Initializing your session...',
      'Loading your conversations...',
      'Setting up notifications...',
      'Preparing your dashboard...',
      'Almost ready...',
    ];

    let messageIndex = 0;
    this.messageInterval = setInterval(() => {
      if (!this.isRedirecting) {
        messageIndex = (messageIndex + 1) % messages.length;
        this.loadingMessage = messages[messageIndex];
      }
    }, 1000);
  }

  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
