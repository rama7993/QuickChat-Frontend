import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Theme {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    background: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  isCustom?: boolean;
  customColors?: {
    primary?: string;
    surface?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'quickchat-theme';
  private readonly CUSTOM_THEME_KEY = 'quickchat-custom-theme';
  private readonly themes: Theme[] = [
    {
      id: 'light-mode',
      name: 'light-mode',
      displayName: 'Light Mode',
      icon: 'pi pi-sun',
      colors: {
        primary: '#ffffff',
        secondary: '#f8fafc',
        accent: '#3b82f6',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textSecondary: '#64748b',
        border: '#e2e8f0',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        secondary: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
        background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
      },
      shadows: {
        small: '0 1px 3px rgba(59, 130, 246, 0.1)',
        medium: '0 4px 6px rgba(59, 130, 246, 0.15)',
        large: '0 10px 15px rgba(59, 130, 246, 0.2)',
      },
      borderRadius: {
        small: '4px',
        medium: '8px',
        large: '12px',
      },
    },
    {
      id: 'dark-mode',
      name: 'dark-mode',
      displayName: 'Dark Mode',
      icon: 'pi pi-moon',
      colors: {
        primary: '#1f2937',
        secondary: '#374151',
        accent: '#3b82f6',
        background: '#111827',
        surface: '#1f2937',
        text: '#ffffff',
        textSecondary: '#d1d5db',
        border: '#374151',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        secondary: 'linear-gradient(135deg, #374151, #1f2937)',
        background: 'linear-gradient(135deg, #111827, #1f2937)',
      },
      shadows: {
        small: '0 2px 8px rgba(0, 0, 0, 0.3)',
        medium: '0 4px 16px rgba(0, 0, 0, 0.4)',
        large: '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        small: '4px',
        medium: '8px',
        large: '12px',
      },
    },
  ];

  private currentThemeSubject = new BehaviorSubject<Theme>(this.themes[0]);
  public currentTheme$ = this.currentThemeSubject.asObservable();
  public currentTheme = signal<Theme>(this.themes[0]);

  constructor() {
    this.loadTheme();
  }

  getThemes(): Theme[] {
    const currentTheme = this.currentTheme();

    // If current theme is custom, apply custom colors to base themes
    if (currentTheme.isCustom && currentTheme.customColors) {
      const customColors = currentTheme.customColors;
      return this.themes.map((theme) => {
        if (theme.id === 'light-mode' || theme.id === 'dark-mode') {
          return {
            ...theme,
            colors: {
              ...theme.colors,
              primary: customColors.primary || theme.colors.primary,
              accent: customColors.primary || theme.colors.accent,
              surface: customColors.surface || theme.colors.surface,
              background: customColors.surface
                ? this.lightenColor(customColors.surface, 5)
                : theme.colors.background,
            },
            gradients: {
              ...theme.gradients,
              primary: customColors.primary
                ? `linear-gradient(135deg, ${
                    customColors.primary
                  }, ${this.darkenColor(customColors.primary, 20)})`
                : theme.gradients.primary,
            },
          };
        }
        return theme;
      });
    }

    return this.themes;
  }

  getCurrentTheme(): Theme {
    return this.currentTheme();
  }

  setTheme(themeId: string): void {
    const theme = this.themes.find((t) => t.id === themeId);
    if (theme) {
      this.currentTheme.set(theme);
      this.currentThemeSubject.next(theme);
      this.applyTheme(theme);
      this.saveTheme(themeId);
    }
  }

  setBaseTheme(themeId: string): void {
    const baseTheme = this.themes.find((t) => t.id === themeId);
    const currentTheme = this.currentTheme();

    if (baseTheme) {
      // If current theme has custom colors, preserve them
      if (currentTheme.isCustom && currentTheme.customColors) {
        const updatedTheme = {
          ...baseTheme,
          id: 'custom',
          name: 'custom',
          displayName: 'Custom Theme',
          icon: baseTheme.icon, // Use the base theme's icon (sun for light, moon for dark)
          isCustom: true,
          customColors: currentTheme.customColors,
          colors: {
            ...baseTheme.colors,
            primary:
              currentTheme.customColors.primary || baseTheme.colors.primary,
            accent:
              currentTheme.customColors.primary || baseTheme.colors.accent,
            surface:
              currentTheme.customColors.surface || baseTheme.colors.surface,
            background: currentTheme.customColors.surface
              ? this.lightenColor(currentTheme.customColors.surface, 5)
              : baseTheme.colors.background,
          },
          gradients: {
            ...baseTheme.gradients,
            primary: currentTheme.customColors.primary
              ? `linear-gradient(135deg, ${
                  currentTheme.customColors.primary
                }, ${this.darkenColor(currentTheme.customColors.primary, 20)})`
              : baseTheme.gradients.primary,
          },
        };

        this.currentTheme.set(updatedTheme);
        this.currentThemeSubject.next(updatedTheme);
        this.applyTheme(updatedTheme);
        this.saveTheme('custom');
        this.saveCustomTheme(updatedTheme);
      } else {
        // No custom colors, just switch to base theme
        this.setTheme(themeId);
      }
    }
  }

  private loadTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    if (savedTheme) {
      if (savedTheme === 'custom') {
        const customTheme = this.loadCustomTheme();
        if (customTheme) {
          this.currentTheme.set(customTheme);
          this.currentThemeSubject.next(customTheme);
          this.applyTheme(customTheme);
          return;
        }
      } else {
        const theme = this.themes.find((t) => t.id === savedTheme);
        if (theme) {
          this.currentTheme.set(theme);
          this.currentThemeSubject.next(theme);
          this.applyTheme(theme);
          return;
        }
      }
    }
    this.applyTheme(this.themes[0]);
  }

  private saveTheme(themeId: string): void {
    localStorage.setItem(this.THEME_KEY, themeId);
  }

  private saveCustomTheme(theme: Theme): void {
    localStorage.setItem(this.CUSTOM_THEME_KEY, JSON.stringify(theme));
  }

  private loadCustomTheme(): Theme | null {
    const customThemeData = localStorage.getItem(this.CUSTOM_THEME_KEY);
    if (customThemeData) {
      try {
        return JSON.parse(customThemeData);
      } catch (error) {
        console.error('Error parsing custom theme data:', error);
        return null;
      }
    }
    return null;
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    // Apply color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply gradient variables
    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--gradient-${key}`, value);
    });

    // Apply shadow variables
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply border radius variables
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    // Apply theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme.name}`);
  }

  // Computed properties for reactive theme access
  public primaryColor = computed(() => this.currentTheme().colors.primary);
  public accentColor = computed(() => this.currentTheme().colors.accent);
  public backgroundColor = computed(
    () => this.currentTheme().colors.background
  );
  public textColor = computed(() => this.currentTheme().colors.text);
  public surfaceColor = computed(() => this.currentTheme().colors.surface);

  // Helper method to get the base theme type (light or dark)
  getBaseThemeType(): 'light-mode' | 'dark-mode' {
    const currentTheme = this.currentTheme();

    // If it's a custom theme, check the icon to determine base type
    if (currentTheme.isCustom) {
      return currentTheme.icon === 'pi pi-sun' ? 'light-mode' : 'dark-mode';
    }

    // For non-custom themes, return the theme ID
    return currentTheme.id as 'light-mode' | 'dark-mode';
  }

  // Custom color methods
  setCustomPrimaryColor(color: string) {
    const currentTheme = this.currentTheme();
    const updatedTheme = {
      ...currentTheme,
      id: 'custom',
      name: 'custom',
      displayName: 'Custom Theme',
      icon: currentTheme.icon, // Preserve the current icon (sun for light, moon for dark)
      isCustom: true,
      customColors: {
        ...currentTheme.customColors,
        primary: color,
      },
      colors: {
        ...currentTheme.colors,
        primary: color,
        accent: color,
      },
      gradients: {
        ...currentTheme.gradients,
        primary: `linear-gradient(135deg, ${color}, ${this.darkenColor(
          color,
          20
        )})`,
      },
    };
    this.currentThemeSubject.next(updatedTheme);
    this.currentTheme.set(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme('custom');
    this.saveCustomTheme(updatedTheme);
  }

  setCustomSurfaceColor(color: string) {
    const currentTheme = this.currentTheme();
    const updatedTheme = {
      ...currentTheme,
      id: 'custom',
      name: 'custom',
      displayName: 'Custom Theme',
      icon: currentTheme.icon, // Preserve the current icon (sun for light, moon for dark)
      isCustom: true,
      customColors: {
        ...currentTheme.customColors,
        surface: color,
      },
      colors: {
        ...currentTheme.colors,
        surface: color,
        background: this.lightenColor(color, 5),
      },
    };
    this.currentThemeSubject.next(updatedTheme);
    this.currentTheme.set(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme('custom');
    this.saveCustomTheme(updatedTheme);
  }

  resetToDefaultTheme() {
    const defaultTheme = this.themes[0]; // Light mode
    this.setTheme(defaultTheme.id);
    // Clear custom theme data
    localStorage.removeItem(this.CUSTOM_THEME_KEY);
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  // Font size management
  setFontSize(size: 'smaller' | 'medium' | 'larger') {
    const root = document.documentElement;

    switch (size) {
      case 'smaller':
        root.style.setProperty('--font-size-base', '14px');
        root.style.setProperty('--font-size-sm', '12px');
        root.style.setProperty('--font-size-lg', '16px');
        root.style.setProperty('--font-size-xl', '18px');
        break;
      case 'medium':
        root.style.setProperty('--font-size-base', '16px');
        root.style.setProperty('--font-size-sm', '14px');
        root.style.setProperty('--font-size-lg', '18px');
        root.style.setProperty('--font-size-xl', '20px');
        break;
      case 'larger':
        root.style.setProperty('--font-size-base', '18px');
        root.style.setProperty('--font-size-sm', '16px');
        root.style.setProperty('--font-size-lg', '20px');
        root.style.setProperty('--font-size-xl', '22px');
        break;
    }

    localStorage.setItem('fontSize', size);
  }

  getFontSize(): 'smaller' | 'medium' | 'larger' {
    return (
      (localStorage.getItem('fontSize') as 'smaller' | 'medium' | 'larger') ||
      'medium'
    );
  }
}
