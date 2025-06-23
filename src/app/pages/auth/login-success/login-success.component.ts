import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login-success',
  imports: [],
  templateUrl: './login-success.component.html',
  styleUrl: './login-success.component.scss',
})
export class LoginSuccessComponent {
  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (token) {
      localStorage.setItem('authToken', token);
    }

    // Slight delay to ensure cookie gets set
    setTimeout(() => {
      this.authService.fetchCurrentUser().subscribe({
        next: () => this.router.navigate(['/chat']),
        error: () => this.router.navigate(['/login']),
      });
    }, 300); // can be 300–500ms
  }
}
