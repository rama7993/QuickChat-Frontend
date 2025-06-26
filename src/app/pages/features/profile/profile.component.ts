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
  uploadedFile: File | null = null;

  ngOnInit(): void {
    this.buildForm();

    const user = this.currentUser();
    if (user) {
      this.profileForm.patchValue(user);
      if (user.photoUrl && this.isValidImageUrl(user.photoUrl)) {
        this.previewUrl = user.photoUrl;
      }
    }

    // Watch for photo URL changes
    this.profileForm.get('photoUrl')?.valueChanges.subscribe((url: string) => {
      if (url && this.isValidImageUrl(url)) {
        this.previewUrl = url;
        this.uploadedFile = null; // clear uploaded file
      }
    });
  }

  buildForm(): void {
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

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.uploadedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
        this.profileForm.get('photoUrl')?.setValue(''); // clear URL input
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
        this.alertService.errorToaster(err?.error || err?.message || err);
      },
    });
  }

  private appendFormFields(
    formData: FormData,
    obj: any,
    parentKey: string = ''
  ) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const formKey = parentKey ? `${parentKey}[${key}]` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof File)
      ) {
        this.appendFormFields(formData, value, formKey); // 🔁 recurse for nested objects
      } else if (value !== undefined && value !== null) {
        formData.append(formKey, value);
      }
    }
  }

  private isValidImageUrl(url: string): boolean {
    return /^https?:\/\/.+\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(url);
  }
}
