import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { SoundNotificationService } from '../../../core/services/notifications/sound-notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private soundNotificationService = inject(SoundNotificationService);

  // Theme customization
  currentTheme = signal(this.themeService.getCurrentTheme());

  // App settings
  appSettings = signal({
    animations: true,
    soundEffects: true,
    notifications: true,
    darkMode: false,
    language: 'en',
    timezone: 'UTC',
    fontSize: 'medium',
  });

  // Dropdown states
  languageDropdownOpen = false;
  timezoneDropdownOpen = false;
  fontSizeDropdownOpen = false;

  // Dropdown options
  languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
  ];

  timezoneOptions = [
    { label: 'UTC', value: 'UTC' },
    { label: 'Eastern Time (ET)', value: 'America/New_York' },
    { label: 'Central Time (CT)', value: 'America/Chicago' },
    { label: 'Mountain Time (MT)', value: 'America/Denver' },
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    { label: 'London (GMT)', value: 'Europe/London' },
    { label: 'Paris (CET)', value: 'Europe/Paris' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  ];

  fontSizeOptions = [
    { label: 'Smaller', value: 'smaller' },
    { label: 'Medium', value: 'medium' },
    { label: 'Larger', value: 'larger' },
  ];

  ngOnInit() {
    this.loadSettings();
    // Apply saved font size
    this.themeService.setFontSize(
      this.appSettings().fontSize as 'smaller' | 'medium' | 'larger'
    );

    // Sync sound settings with sound notification service
    this.soundNotificationService.updateSettings({
      enabled: this.appSettings().soundEffects,
    });

    // Subscribe to theme changes
    this.themeService.currentTheme$.subscribe((theme) => {
      this.currentTheme.set(theme);
    });
  }

  // Theme methods
  switchTheme(themeId: string) {
    this.themeService.setBaseTheme(themeId);
    this.currentTheme.set(this.themeService.getCurrentTheme());
  }

  // Color picker methods
  onPrimaryColorChange(color: string) {
    this.themeService.setCustomPrimaryColor(color);
  }

  onSurfaceColorChange(color: string) {
    this.themeService.setCustomSurfaceColor(color);
  }

  resetToDefault() {
    this.themeService.resetToDefaultTheme();
  }

  // App settings methods
  onCheckboxChange(setting: string, event: Event) {
    const target = event.target as HTMLInputElement;
    this.appSettings.update((settings) => ({
      ...settings,
      [setting]: target.checked,
    }));
    this.saveSettings();

    // Update sound notification service if sound settings changed
    if (setting === 'soundEffects') {
      this.soundNotificationService.updateSettings({
        enabled: target.checked,
      });
    }
  }

  onSelectChange(setting: string, event: Event) {
    const target = event.target as HTMLSelectElement;
    this.appSettings.update((settings) => ({
      ...settings,
      [setting]: target.value,
    }));
    this.saveSettings();

    // Apply font size changes immediately
    if (setting === 'fontSize') {
      this.themeService.setFontSize(
        target.value as 'smaller' | 'medium' | 'larger'
      );
    }
  }

  // PrimeNG dropdown event handlers
  onLanguageChange(value: string) {
    this.appSettings.update((settings) => ({
      ...settings,
      language: value,
    }));
    this.saveSettings();
  }

  onTimezoneChange(value: string) {
    this.appSettings.update((settings) => ({
      ...settings,
      timezone: value,
    }));
    this.saveSettings();
  }

  onFontSizeChange(value: string) {
    this.appSettings.update((settings) => ({
      ...settings,
      fontSize: value,
    }));
    this.saveSettings();
    this.themeService.setFontSize(value as 'smaller' | 'medium' | 'larger');
  }

  // Custom dropdown methods
  toggleLanguageDropdown() {
    this.languageDropdownOpen = !this.languageDropdownOpen;
    this.timezoneDropdownOpen = false;
    this.fontSizeDropdownOpen = false;
  }

  toggleTimezoneDropdown() {
    this.timezoneDropdownOpen = !this.timezoneDropdownOpen;
    this.languageDropdownOpen = false;
    this.fontSizeDropdownOpen = false;
  }

  toggleFontSizeDropdown() {
    this.fontSizeDropdownOpen = !this.fontSizeDropdownOpen;
    this.languageDropdownOpen = false;
    this.timezoneDropdownOpen = false;
  }

  selectLanguage(value: string) {
    this.appSettings.update((settings) => ({ ...settings, language: value }));
    this.languageDropdownOpen = false;
    this.saveSettings();
  }

  selectTimezone(value: string) {
    this.appSettings.update((settings) => ({ ...settings, timezone: value }));
    this.timezoneDropdownOpen = false;
    this.saveSettings();
  }

  selectFontSize(value: string) {
    this.appSettings.update((settings) => ({ ...settings, fontSize: value }));
    this.fontSizeDropdownOpen = false;
    this.saveSettings();
    this.themeService.setFontSize(value as 'smaller' | 'medium' | 'larger');
  }

  getLanguageLabel(): string {
    const option = this.languageOptions.find(
      (opt) => opt.value === this.appSettings().language
    );
    return option ? option.label : 'Select Language';
  }

  getTimezoneLabel(): string {
    const option = this.timezoneOptions.find(
      (opt) => opt.value === this.appSettings().timezone
    );
    return option ? option.label : 'Select Timezone';
  }

  getFontSizeLabel(): string {
    const option = this.fontSizeOptions.find(
      (opt) => opt.value === this.appSettings().fontSize
    );
    return option ? option.label : 'Select Font Size';
  }

  // Navigation
  goBack() {
    this.router.navigate(['/chat']);
  }

  // Settings persistence
  private loadSettings() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        this.appSettings.set(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }

  private saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(this.appSettings()));
  }

  // Test sound functionality
  testSound() {
    this.soundNotificationService.testSound();
  }
}
