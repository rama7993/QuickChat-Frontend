import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AlertService } from '../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [RouterModule, CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loginForm!: FormGroup;
  showPassword = false;
  isSubmitting = false;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private alertService: AlertService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  get email() {
    return this.loginForm.get('email')!;
  }

  get password() {
    return this.loginForm.get('password')!;
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isSubmitting = true;
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: () => {
          setTimeout(() => {
            this.router.navigate(['/chat']);
          }, 100);
        },
        error: (err) => {
          this.logger.error('Login error', err.error);

          let errorMessage = 'Login failed';

          // Handle different error formats
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error?.message) {
            errorMessage = err.error.message;
          } else if (err.error?.error) {
            errorMessage = err.error.error;
          }

          this.alertService.errorToaster(errorMessage);
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        },
      });
    } else {
      this.loginForm.markAllAsTouched();
      this.alertService.warningToaster(
        'Please fill in all required fields correctly'
      );
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  loginWith(provider: 'google' | 'linkedin') {
    window.location.href = `${environment.apiUrl}/auth/${provider}`;
  }

  loginAsDemo() {
    this.isSubmitting = true;
    this.authService.loginDemo().subscribe({
      next: () => {
        setTimeout(() => {
          this.router.navigate(['/chat']);
        }, 100);
      },
      error: (err) => {
        this.logger.error('Demo Login error', err);
        this.alertService.errorToaster('Failed to login as guest');
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }
}
