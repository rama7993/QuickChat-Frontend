import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AlertService } from '../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../core/services/logging/logger.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private logger = inject(LoggerService);

  resetPasswordForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;
  token: string | null = null;

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'];

    if (!this.token) {
      this.alertService.errorToaster(
        'Invalid reset link. Please request a new password reset.'
      );
      this.router.navigate(['/forgot-password']);
      return;
    }

    this.resetPasswordForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  get password() {
    return this.resetPasswordForm.get('password')!;
  }

  get confirmPassword() {
    return this.resetPasswordForm.get('confirmPassword')!;
  }

  onSubmit() {
    if (this.resetPasswordForm.valid && this.token) {
      this.isSubmitting = true;
      const { password } = this.resetPasswordForm.value;

      this.authService.resetPassword(this.token, password).subscribe({
        next: (response) => {
          this.alertService.successToaster(
            response.message || 'Password has been reset successfully'
          );
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.logger.error('Reset password error', err.error);
          const errorMessage =
            err.error?.message ||
            err.error?.error ||
            'Failed to reset password';
          this.alertService.errorToaster(errorMessage);
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        },
      });
    } else {
      this.resetPasswordForm.markAllAsTouched();
      this.alertService.warningToaster('Please fill in all fields correctly');
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.resetPasswordForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
