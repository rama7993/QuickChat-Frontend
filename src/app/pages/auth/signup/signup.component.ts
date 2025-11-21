import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../core/services/logging/logger.service';
@Component({
  selector: 'app-signup',
  imports: [RouterModule, CommonModule, ReactiveFormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  signupForm!: FormGroup;
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
    this.signupForm = this.fb.group({
      fname: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ],
      ],
      lname: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(100),
        ],
      ],
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.signupForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onSubmit() {
    if (this.signupForm.valid) {
      this.isSubmitting = true;
      const { fname, lname, email, password } = this.signupForm.value;

      const registerData = {
        firstName: fname.trim(),
        lastName: lname.trim(),
        email: email.trim().toLowerCase(),
        password,
      };

      this.authService.register(registerData).subscribe({
        next: (res) => {
          // console.log('Registration successful:', res); // Commented for production
          this.alertService.successToaster(
            'Registration successful! Please login to continue.'
          );
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.logger.error('Registration error', err.error);
          const errorMessage =
            err.error?.message ||
            err.error?.error ||
            'Registration failed. Please try again.';
          this.alertService.errorToaster(errorMessage);
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        },
      });
    } else {
      this.signupForm.markAllAsTouched();
      this.alertService.warningToaster(
        'Please fill in all required fields correctly'
      );
    }
  }
}
