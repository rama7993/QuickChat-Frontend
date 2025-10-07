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
import { Default_Img_Url } from '../../../../utils/constants.utils';

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
  isUpdating = signal(false);
  activeTab = signal<'basic' | 'privacy'>('basic');
  defaultAvatar = Default_Img_Url;

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
      // Basic Information
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: [''],
      email: ['', [Validators.required, Validators.email]],
      gender: [''],
      bio: ['', [Validators.maxLength(2000)]],
      photoUrl: [''],
      age: [null, [Validators.min(18), Validators.max(120)]],
      statusMessage: ['', [Validators.maxLength(100)]],

      // Address
      address: this.fb.group({
        street: [''],
        city: [''],
        state: [''],
        zip: [''],
      }),

      // Notification Settings
      notificationSettings: this.fb.group({
        emailNotifications: [true],
        pushNotifications: [true],
        soundNotifications: [true],
        messagePreview: [true],
        groupNotifications: [true],
      }),

      // Privacy Settings
      privacySettings: this.fb.group({
        showLastSeen: [true],
        showStatus: [true],
        allowGroupInvites: [true],
        allowFriendRequests: [true],
      }),

      // Preferences
      preferences: this.fb.group({
        theme: ['auto'],
        language: ['en'],
        timezone: ['UTC'],
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

    this.isUpdating.set(true);
    const formValue = this.profileForm.value;

    this.authService.updateUserById(userId, formValue).subscribe({
      next: (resp: any) => {
        this.authService.updateUser(resp.user);
        this.alertService.successToaster('Profile updated successfully!');
        this.isUpdating.set(false);
      },
      error: (err) => {
        console.error('Update failed', err);
        this.alertService.errorToaster(err?.error || err?.message || err);
        this.isUpdating.set(false);
      },
    });
  }

  onFileUploaded(result: any) {
    this.profileForm.get('photoUrl')?.setValue(result.url);
    this.previewUrl = result.url;
  }

  onFileUploadError(error: string) {
    this.alertService.errorToaster(error);
  }

  setActiveTab(tab: 'basic' | 'privacy') {
    this.activeTab.set(tab);
  }

  getGenderOptions() {
    return ['Male', 'Female', 'Others'];
  }

  changeProfilePicture() {
    // Implement profile picture change functionality
    // console.log('Change profile picture'); // Commented for production
  }

  removeProfilePicture() {
    // Implement profile picture removal functionality
    // console.log('Remove profile picture'); // Commented for production
  }

  getThemeOptions() {
    return [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'auto', label: 'Auto' },
    ];
  }

  getLanguageOptions() {
    return [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
      { value: 'de', label: 'German' },
      { value: 'zh', label: 'Chinese' },
    ];
  }

  getTimezoneOptions() {
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time' },
      { value: 'America/Chicago', label: 'Central Time' },
      { value: 'America/Denver', label: 'Mountain Time' },
      { value: 'America/Los_Angeles', label: 'Pacific Time' },
      { value: 'Europe/London', label: 'London' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Asia/Tokyo', label: 'Tokyo' },
    ];
  }

  goBack() {
    this.router.navigate(['/chat']);
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
