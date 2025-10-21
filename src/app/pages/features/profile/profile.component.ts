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
      phone: ['', [Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
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
        showOnlineStatus: [true],
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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.alertService.errorToaster('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.alertService.errorToaster('Image size must be less than 5MB');
        return;
      }

      this.uploadedFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
        this.profileForm.get('photoUrl')?.setValue(''); // clear URL input
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.alertService.errorToaster('Please fix the form errors before submitting');
      return;
    }

    const userId = this.currentUser()?._id;
    if (!userId) {
      this.alertService.errorToaster('User not found. Please log in again.');
      return;
    }

    this.isUpdating.set(true);
    
    // If there's an uploaded file, upload it first
    if (this.uploadedFile) {
      this.uploadProfilePicture(this.uploadedFile, userId);
    } else {
      // No file upload, just update profile
      this.updateProfile(userId);
    }
  }

  private uploadProfilePicture(file: File, userId: string) {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    // Upload file first
    this.authService.uploadProfilePicture(formData).subscribe({
      next: (uploadResponse: any) => {
        // Update profile with the uploaded image URL
        const formValue = this.cleanFormData(this.profileForm.value);
        formValue.photoUrl = uploadResponse.url || uploadResponse.imageUrl;
        
        this.updateProfile(userId, formValue);
      },
      error: (err) => {
        console.error('File upload failed', err);
        this.alertService.errorToaster('Failed to upload profile picture');
        this.isUpdating.set(false);
      }
    });
  }

  private updateProfile(userId: string, formValue?: any) {
    const profileData = formValue || this.cleanFormData(this.profileForm.value);
    
    this.authService.updateUserById(userId, profileData).subscribe({
      next: (resp: any) => {
        this.authService.updateUser(resp.user);
        this.alertService.successToaster('Profile updated successfully!');
        this.isUpdating.set(false);
        this.uploadedFile = null; // Clear uploaded file
      },
      error: (err) => {
        console.error('Update failed', err);
        const errorMessage = err?.error?.message || err?.message || 'Failed to update profile';
        this.alertService.errorToaster(errorMessage);
        this.isUpdating.set(false);
      },
    });
  }

  private cleanFormData(data: any): any {
    const cleaned: any = {};
    
    for (const key in data) {
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
          const cleanedNested = this.cleanFormData(data[key]);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = data[key];
        }
      }
    }
    
    return cleaned;
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
    this.previewUrl = null;
    this.uploadedFile = null;
    this.profileForm.get('photoUrl')?.setValue('');
    this.alertService.successToaster('Profile picture removed. Click Save Changes to apply.');
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
