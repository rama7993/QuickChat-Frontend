import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Theme interface definition
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

    if (currentTheme.isCustom && currentTheme.customColors) {
      const customColors = currentTheme.customColors;
      return this.themes.map((theme) => {
        if (theme.id === 'light-mode' || theme.id === 'dark-mode') {
          const surface = customColors.surface || theme.colors.surface;
          const contrast = this.getContrastColors(surface);

          return {
            ...theme,
            colors: {
              ...theme.colors,
              ...contrast,
              primary: customColors.primary || theme.colors.primary,
              accent: customColors.primary || theme.colors.accent,
              surface: surface,
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
      if (currentTheme.isCustom && currentTheme.customColors) {
        const surface =
          currentTheme.customColors.surface || baseTheme.colors.surface;
        const contrast = this.getContrastColors(surface);

        const updatedTheme: Theme = {
          ...baseTheme,
          id: 'custom',
          name: 'custom',
          displayName: 'Custom Theme',
          icon: baseTheme.icon,
          isCustom: true,
          customColors: currentTheme.customColors,
          colors: {
            ...baseTheme.colors,
            ...contrast,
            primary:
              currentTheme.customColors.primary || baseTheme.colors.primary,
            accent:
              currentTheme.customColors.primary || baseTheme.colors.accent,
            surface: surface,
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
        return null;
      }
    }
    return null;
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--gradient-${key}`, value);
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme.name}`);
  }

  public primaryColor = computed(() => this.currentTheme().colors.primary);
  public accentColor = computed(() => this.currentTheme().colors.accent);
  public backgroundColor = computed(
    () => this.currentTheme().colors.background,
  );
  public textColor = computed(() => this.currentTheme().colors.text);
  public surfaceColor = computed(() => this.currentTheme().colors.surface);

  // Custom color methods
  setCustomPrimaryColor(color: string) {
    const currentTheme = this.currentTheme();
    const updatedTheme: Theme = {
      ...currentTheme,
      id: 'custom',
      name: 'custom',
      displayName: 'Custom Theme',
      icon: currentTheme.icon,
      isCustom: true,
      customColors: {
        ...currentTheme.customColors,
        primary: color,
      },
      colors: {
        ...currentTheme.colors,
        primary:
          this.getBaseThemeType() === 'light-mode'
            ? currentTheme.colors.primary
            : color,
        accent: color,
      },
      gradients: {
        ...currentTheme.gradients,
        primary: `linear-gradient(135deg, ${color}, ${this.darkenColor(
          color,
          20,
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
    const contrast = this.getContrastColors(color);

    const updatedTheme: Theme = {
      ...currentTheme,
      id: 'custom',
      name: 'custom',
      displayName: 'Custom Theme',
      icon: currentTheme.icon,
      isCustom: true,
      customColors: {
        ...currentTheme.customColors,
        surface: color,
      },
      colors: {
        ...currentTheme.colors,
        ...contrast,
        surface: color,
      },
    };
    this.currentThemeSubject.next(updatedTheme);
    this.currentTheme.set(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme('custom');
    this.saveCustomTheme(updatedTheme);
  }

  resetToDefaultTheme() {
    localStorage.removeItem(this.CUSTOM_THEME_KEY);
    this.setTheme('light-mode');
  }

  private getContrastColors(backgroundColor: string) {
    const isLight = this.isLightColor(backgroundColor);
    return {
      background: isLight
        ? this.darkenColor(backgroundColor, 3)
        : this.lightenColor(backgroundColor, 5),
      text: isLight ? '#1e293b' : '#ffffff',
      textSecondary: isLight ? '#64748b' : '#d1d5db',
      border: isLight
        ? this.darkenColor(backgroundColor, 10)
        : this.lightenColor(backgroundColor, 10),
    };
  }

  private isLightColor(color: string): boolean {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Perceptual brightness formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  }

  private darkenColor(color: string, percent: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * percent);
    let r = (num >> 16) - amt;
    let g = ((num >> 8) & 0x00ff) - amt;
    let b = (num & 0x0000ff) - amt;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  private lightenColor(color: string, percent: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * percent);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0x00ff) + amt;
    let b = (num & 0x0000ff) + amt;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  public getBaseThemeType(): 'light-mode' | 'dark-mode' {
    const current = this.currentTheme();
    if (!current.isCustom) return current.id as 'light-mode' | 'dark-mode';

    const savedBase = localStorage.getItem(this.THEME_KEY);
    return savedBase === 'dark-mode' ? 'dark-mode' : 'light-mode';
  }

  setFontSize(size: 'smaller' | 'medium' | 'larger') {
    const root = document.documentElement;
    localStorage.setItem('fontSize', size);

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
  }

  getFontSize(): 'smaller' | 'medium' | 'larger' {
    return (
      (localStorage.getItem('fontSize') as 'smaller' | 'medium' | 'larger') ||
      'medium'
    );
  }
}
