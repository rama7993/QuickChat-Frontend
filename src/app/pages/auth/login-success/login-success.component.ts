import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login-success',
  imports: [],
  templateUrl: './login-success.component.html',
  styleUrl: './login-success.component.scss',
})
export class LoginSuccessComponent {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.fetchCurrentUser().subscribe({
      next: () => {
        setTimeout(() => {
          this.router.navigate(['/chat']);
        }, 2000);
      },
      error: () => this.router.navigate(['/login']),
    });
  }
}
