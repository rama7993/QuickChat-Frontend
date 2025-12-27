import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../../core/services/theme/theme.service';

export interface ColorPreset {
  name: string;
  colors: string[];
}

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss',
})
export class ColorPickerComponent {
  private themeService = inject(ThemeService);

  @Input() type: 'primary' | 'surface' = 'primary';
  @Input() label: string = 'Color';
  @Output() colorChange = new EventEmitter<string>();

  public selectedColor = signal('#a855f7');
  public customColor = signal('#a855f7');
  public showCustomPicker = signal(false);

  // Color presets similar to PrimeNG
  public colorPresets: ColorPreset[] = [
    {
      name: 'Primary Colors',
      colors: [
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#a855f7', // Purple
        '#d946ef', // Fuchsia
        '#ec4899', // Pink
        '#f43f5e', // Rose
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#eab308', // Yellow
        '#84cc16', // Lime
        '#22c55e', // Green
        '#10b981', // Emerald
        '#14b8a6', // Teal
        '#06b6d4', // Cyan
        '#0ea5e9', // Sky
        '#3b82f6', // Blue
        '#6366f1', // Indigo
      ],
    },
  ];

  public surfacePresets: ColorPreset[] = [
    {
      name: 'Surface Colors',
      colors: [
        '#0f172a', // Slate 900
        '#1e293b', // Slate 800
        '#334155', // Slate 700
        '#475569', // Slate 600
        '#64748b', // Slate 500
        '#94a3b8', // Slate 400
        '#cbd5e1', // Slate 300
        '#e2e8f0', // Slate 200
        '#f1f5f9', // Slate 100
      ],
    },
  ];

  ngOnInit() {
    // Initialize with current theme color
    if (this.type === 'primary') {
      this.selectedColor.set(this.themeService.primaryColor());
      this.customColor.set(this.themeService.primaryColor());
    } else {
      this.selectedColor.set(this.themeService.surfaceColor());
      this.customColor.set(this.themeService.surfaceColor());
    }
  }

  selectPresetColor(color: string) {
    this.selectedColor.set(color);
    this.customColor.set(color);
    this.applyColor(color);
  }

  onCustomColorChange(color: string) {
    this.customColor.set(color);
    this.selectedColor.set(color);
    this.applyColor(color);
  }

  onColorInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.onCustomColorChange(target.value);
  }

  onTextInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.onCustomColorChange(target.value);
  }

  toggleCustomPicker() {
    this.showCustomPicker.set(!this.showCustomPicker());
  }

  private applyColor(color: string) {
    if (this.type === 'primary') {
      this.themeService.setCustomPrimaryColor(color);
    } else {
      this.themeService.setCustomSurfaceColor(color);
    }
    this.colorChange.emit(color);
  }

  getCurrentPresets(): ColorPreset[] {
    return this.type === 'primary' ? this.colorPresets : this.surfacePresets;
  }

  isColorSelected(color: string): boolean {
    return this.selectedColor() === color;
  }
}
