import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
  OnInit,
  effect,
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
export class ColorPickerComponent implements OnInit {
  private themeService = inject(ThemeService);

  @Input() type: 'primary' | 'surface' = 'primary';
  @Input() label: string = 'Color';
  @Output() colorChange = new EventEmitter<string>();

  public selectedColor = signal('#a855f7');
  public customColor = signal('#a855f7');
  public showCustomPicker = signal(false);

  public colorPresets: ColorPreset[] = [
    {
      name: 'Primary Colors',
      colors: [
        '#6366f1',
        '#8b5cf6',
        '#a855f7',
        '#d946ef',
        '#ec4899',
        '#f43f5e',
        '#ef4444',
        '#f97316',
        '#f59e0b',
        '#eab308',
        '#84cc16',
        '#22c55e',
        '#10b981',
        '#14b8a6',
        '#06b6d4',
        '#0ea5e9',
        '#3b82f6',
      ],
    },
  ];

  public surfacePresets: ColorPreset[] = [
    {
      name: 'Surface Colors',
      colors: [
        '#0f172a',
        '#1e293b',
        '#334155',
        '#475569',
        '#64748b',
        '#94a3b8',
        '#cbd5e1',
        '#e2e8f0',
        '#f1f5f9',
      ],
    },
  ];

  constructor() {
    effect(() => {
      const color =
        this.type === 'primary'
          ? this.themeService.accentColor()
          : this.themeService.surfaceColor();
      this.selectedColor.set(color);
      this.customColor.set(color);
    });
  }

  ngOnInit() {}

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
    return this.selectedColor().toLowerCase() === color.toLowerCase();
  }
}
