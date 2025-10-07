import { Injectable, signal } from '@angular/core';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  soundType: 'default' | 'custom';
  customSoundUrl?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SoundNotificationService {
  private audioContext: AudioContext | null = null;
  private soundSettings = signal<SoundSettings>({
    enabled: true,
    volume: 0.7,
    soundType: 'default',
  });

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    const saved = localStorage.getItem('soundNotificationSettings');
    if (saved) {
      try {
        this.soundSettings.set(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading sound settings:', error);
      }
    }
  }

  private saveSettings() {
    localStorage.setItem(
      'soundNotificationSettings',
      JSON.stringify(this.soundSettings())
    );
  }

  getSettings() {
    return this.soundSettings.asReadonly();
  }

  updateSettings(settings: Partial<SoundSettings>) {
    this.soundSettings.update((current) => ({ ...current, ...settings }));
    this.saveSettings();
  }

  async playNotificationSound(
    type: 'message' | 'group' | 'system' = 'message'
  ) {
    if (!this.soundSettings().enabled) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const frequency = this.getFrequencyForType(type);
      const duration = 0.3;
      const sampleRate = this.audioContext.sampleRate;
      const buffer = this.audioContext.createBuffer(
        1,
        sampleRate * duration,
        sampleRate
      );
      const data = buffer.getChannelData(0);

      // Generate a pleasant notification sound
      for (let i = 0; i < sampleRate * duration; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 8); // Exponential decay
        const wave = Math.sin(2 * Math.PI * frequency * t) * envelope;
        data[i] = wave * this.soundSettings().volume;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  private getFrequencyForType(type: string): number {
    switch (type) {
      case 'message':
        return 800; // Pleasant mid-frequency
      case 'group':
        return 600; // Slightly lower for group messages
      case 'system':
        return 1000; // Higher for system notifications
      default:
        return 800;
    }
  }

  async playCustomSound(url: string) {
    if (!this.soundSettings().enabled) return;

    try {
      const audio = new Audio(url);
      audio.volume = this.soundSettings().volume;
      await audio.play();
    } catch (error) {
      console.error('Error playing custom sound:', error);
    }
  }

  // Predefined notification sounds
  async playMessageSound() {
    await this.playNotificationSound('message');
  }

  async playGroupSound() {
    await this.playNotificationSound('group');
  }

  async playSystemSound() {
    await this.playNotificationSound('system');
  }

  // Test sound functionality
  async testSound() {
    await this.playNotificationSound('message');
  }
}
