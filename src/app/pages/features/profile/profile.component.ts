import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AlertService } from '../../../core/services/alerts/alert.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  profileForm!: FormGroup;
  previewUrl: string | ArrayBuffer | null = null;
  currentUser = this.authService.currentUser;

  ngOnInit() {
    this.buildForm();
    console.log(this.currentUser());
    this.profileForm.patchValue(this.currentUser());
  }

  buildForm() {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      gender: [''],
      bio: [''],
      photoUrl: [''],
      age: [null, [Validators.min(18)]],
      address: this.fb.group({
        street: [''],
        city: [''],
        state: [''],
        zip: [''],
      }),
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
        this.profileForm.patchValue({ photoUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    if (this.profileForm.invalid) return;

    const userId = this.currentUser()?._id;
    if (!userId) return;

    const formValue = this.profileForm.value;
    this.authService.updateUserById(userId, formValue).subscribe({
      next: (resp: any) => {
        this.authService.updateUser(resp.user);
        this.alertService.successToaster('User updated!');
        this.router.navigate(['/chat']);
      },
      error: (err) => {
        console.error('Update failed', err);
      },
    });
  }
}
