import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AlertService } from '../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../core/services/logging/logger.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private logger = inject(LoggerService);

  forgotPasswordForm!: FormGroup;
  isSubmitting = false;
  emailSent = false;

  ngOnInit() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get email() {
    return this.forgotPasswordForm.get('email')!;
  }

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isSubmitting = true;
      const { email } = this.forgotPasswordForm.value;

      this.authService.forgotPassword(email).subscribe({
        next: (response) => {
          this.emailSent = true;
          this.alertService.successToaster(
            response.message ||
              'Password reset link has been sent to your email.'
          );
        },
        error: (err) => {
          this.logger.error('Forgot password error', err.error);
          const errorMessage =
            err.error?.message ||
            err.error?.error ||
            'Failed to send reset link';
          this.alertService.errorToaster(errorMessage);
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        },
      });
    } else {
      this.forgotPasswordForm.markAllAsTouched();
      this.alertService.warningToaster('Please enter a valid email address');
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.forgotPasswordForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
