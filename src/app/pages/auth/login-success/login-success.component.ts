import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SafeStorageService } from '../../../core/services/storage/safe-storage.service';

@Component({
  selector: 'app-login-success',
  imports: [],
  templateUrl: './login-success.component.html',
  styleUrl: './login-success.component.scss',
})
export class LoginSuccessComponent {
  constructor(
    private safeStorage: SafeStorageService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (token) {
      this.safeStorage.set('authToken', token);
    }

    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        setTimeout(() => this.router.navigate(['/chat']), 2000);
      },
      error: () => this.router.navigate(['/login']),
    });
  }
}
