import {
  Component,
  inject,
  signal,
  EventEmitter,
  Output,
  Input,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../core/services/chat/chat.service';

export interface VoiceRecordingResult {
  audioBlob: Blob;
  duration: number;
  audioUrl: string;
}

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-recorder.component.html',
  styleUrl: './voice-recorder.component.scss',
})
export class VoiceRecorderComponent implements OnDestroy {
  private chatService = inject(ChatService);

  @Input() receiverId?: string;
  @Input() groupId?: string;
  @Output() recordingComplete = new EventEmitter<VoiceRecordingResult>();
  @Output() recordingError = new EventEmitter<string>();
  @Output() recordingCancelled = new EventEmitter<void>();

  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;

  isRecording = signal(false);
  isPaused = signal(false);
  recordingDuration = signal(0);
  audioLevel = signal(0);
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  recordingInterval: any;
  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  microphone: MediaStreamAudioSourceNode | null = null;
  stream: MediaStream | null = null;
  isCancelled = false;

  // Wave visualization
  waveBars: { height: number; delay: number }[] = [];
  waveAnimationInterval: any;

  async startRecording() {
    try {
      // Request microphone access with enhanced audio settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      });

      // Set up audio context for level monitoring
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);

      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.microphone.connect(this.analyser);

      // Set up media recorder with better quality settings
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      };

      // Fallback to different formats if opus is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options.mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options.mimeType = 'audio/wav';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.recordingError.emit('Recording failed');
        this.stopRecording();
      };

      // Start recording with smaller time slices for better responsiveness
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording.set(true);
      this.isCancelled = false;
      this.recordingDuration.set(0);

      // Start duration timer
      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((duration) => duration + 0.1);
      }, 100);

      // Start audio level monitoring
      this.monitorAudioLevel();

      // Initialize wave bars
      this.initializeWaveBars();
      this.startWaveAnimation();
    } catch (error: any) {
      console.error('Error starting recording:', error);
      this.recordingError.emit('Microphone access denied or not available');
    }
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused.set(true);
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
      }
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused.set(false);
      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((duration) => duration + 0.1);
      }, 100);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // cleanup will be called in onstop handler
    } else {
      this.cleanup();
    }
  }

  cancelRecording() {
    this.isCancelled = true;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    this.recordingCancelled.emit();
  }

  private processRecording() {
    if (this.isCancelled) {
      return;
    }

    if (this.audioChunks.length === 0) {
      this.recordingError.emit('No audio data recorded');
      return;
    }

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const duration = this.recordingDuration();

    const result: VoiceRecordingResult = {
      audioBlob,
      duration,
      audioUrl,
    };

    this.recordingComplete.emit(result);
  }

  private monitorAudioLevel() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLevel = () => {
      if (this.isRecording() && !this.isPaused()) {
        this.analyser!.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        this.audioLevel.set(Math.round(average));

        requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  }

  private cleanup() {
    this.isRecording.set(false);
    this.isPaused.set(false);
    this.recordingDuration.set(0);
    this.audioLevel.set(0);

    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    if (this.waveAnimationInterval) {
      clearInterval(this.waveAnimationInterval);
      this.waveAnimationInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.microphone = null;
    this.mediaRecorder = null;
    this.waveBars = [];
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private initializeWaveBars() {
    this.waveBars = [];
    for (let i = 0; i < 20; i++) {
      this.waveBars.push({
        height: Math.random() * 30 + 10, // Random height between 10-40%
        delay: i * 50, // Staggered delay for wave effect
      });
    }
  }

  private startWaveAnimation() {
    this.waveAnimationInterval = setInterval(() => {
      if (this.isRecording() && !this.isPaused()) {
        // Update wave bars with audio level influence
        this.waveBars = this.waveBars.map((bar) => ({
          ...bar,
          height: Math.max(10, Math.random() * (this.audioLevel() * 0.8 + 20)),
        }));
      }
    }, 150);
  }
}
