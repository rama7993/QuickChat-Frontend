import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ThemeService,
  Theme,
} from '../../../core/services/theme/theme.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  templateUrl: './theme-selector.component.html',
  styleUrl: './theme-selector.component.scss',
})
export class ThemeSelectorComponent {
  private themeService = inject(ThemeService);

  public isOpen = signal(false);

  // Use computed signals instead of manual subscriptions
  public currentTheme = computed(() => this.themeService.getCurrentTheme());
  public themes = computed(() => {
    const baseThemes = this.themeService.getThemes();
    const currentTheme = this.themeService.getCurrentTheme();

    // If current theme is custom, include it in the themes list
    if (currentTheme.isCustom) {
      return [...baseThemes, currentTheme];
    } else {
      return baseThemes;
    }
  });

  constructor() {
    // Use effect to react to theme changes without manual subscriptions
    effect(() => {
      // This will automatically run when the theme changes
      this.themeService.getCurrentTheme();
    });
  }

  selectTheme(theme: Theme): void {
    // If selecting a base theme (light-mode or dark-mode), use setBaseTheme to preserve custom colors
    if (theme.id === 'light-mode' || theme.id === 'dark-mode') {
      this.themeService.setBaseTheme(theme.id);
    } else {
      // For custom themes, use regular setTheme
      this.themeService.setTheme(theme.id);
    }
    this.isOpen.set(false);
  }

  isThemeActive(theme: Theme): boolean {
    const currentTheme = this.currentTheme();

    // If current theme is custom, check if it's based on the same base theme
    if (currentTheme?.isCustom) {
      if (theme.id === 'light-mode') {
        return currentTheme.icon === 'pi pi-sun';
      } else if (theme.id === 'dark-mode') {
        return currentTheme.icon === 'pi pi-moon';
      } else if (theme.id === 'custom') {
        return true;
      }
    }

    // For non-custom themes, check direct ID match
    return currentTheme?.id === theme.id;
  }

  toggleSelector(): void {
    this.isOpen.set(!this.isOpen());
  }

  closeSelector(): void {
    this.isOpen.set(false);
  }
}
