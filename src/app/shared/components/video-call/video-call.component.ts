import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  signal,
  ViewChild,
  ElementRef,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  VideoCallService,
  VideoCallParticipant,
} from '../../../core/services/video-call/video-call.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AlertService } from '../../../core/services/alerts/alert.service';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-call.component.html',
  styleUrl: './video-call.component.scss',
})
export class VideoCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() roomId: string = '';
  @Input() participants: string[] = [];
  @Output() callEnded = new EventEmitter<void>();

  @ViewChild('videoGrid') videoGridRef!: ElementRef<HTMLDivElement>;

  private videoCallService = inject(VideoCallService);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);

  // Getter to access service's callState signal reactively
  get callState() {
    return this.videoCallService.getCallState();
  }

  participants$!: Observable<VideoCallParticipant[]>;

  isGridLayout = signal(true);
  selectedParticipant = signal<VideoCallParticipant | null>(null);
  deviceStatusMessage = computed(() => {
    const error = this.videoCallService.getErrorMessageSignal()();
    if (error) return error;
    return this.videoCallService.getWarningMessageSignal()();
  });
  private participantsSubscription?: Subscription;
  private videoElementMap = new Map<string, HTMLVideoElement>();

  ngOnInit() {
    this.participants$ = this.videoCallService.participants$;
    this.startCall();
  }

  ngAfterViewInit() {
    // Subscribe to participants changes with debounce to avoid excessive updates
    this.participantsSubscription = this.participants$
      .pipe(debounceTime(50))
      .subscribe((participants) => {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          this.updateVideoElements(participants);
        });
      });
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.participantsSubscription) {
      this.participantsSubscription.unsubscribe();
    }
    // Clear video element map
    this.videoElementMap.clear();
    this.endCall();
  }

  private updateVideoElements(participants: VideoCallParticipant[]) {
    // Update the video element map
    participants.forEach((participant) => {
      if (participant.stream) {
        // Find video element by participant ID
        let videoElement = document.querySelector(
          `video[data-participant-id="${participant.id}"]`
        ) as HTMLVideoElement;

        // If element not found, try to get from map
        if (!videoElement && this.videoElementMap.has(participant.id)) {
          videoElement = this.videoElementMap.get(participant.id)!;
          // Check if element is still in DOM
          if (!document.contains(videoElement)) {
            this.videoElementMap.delete(participant.id);
            videoElement = null as any;
          }
        }

        if (videoElement) {
          // Update map
          this.videoElementMap.set(participant.id, videoElement);

          // Only update if srcObject changed
          if (videoElement.srcObject !== participant.stream) {
            // Check if element is still in DOM before updating
            if (document.contains(videoElement)) {
              videoElement.srcObject = participant.stream;

              // Only call play if video is not already playing and element is in DOM
              if (videoElement.paused && document.contains(videoElement)) {
                videoElement.play().catch((error) => {
                  // Only log if it's not an abort error (which is expected during DOM updates)
                  if (
                    error.name !== 'AbortError' &&
                    error.name !== 'NotAllowedError'
                  ) {
                    console.error('Error playing video:', error);
                  }
                });
              }
            }
          } else if (videoElement.paused && document.contains(videoElement)) {
            // If srcObject is same but video is paused, try to play
            videoElement.play().catch((error) => {
              if (
                error.name !== 'AbortError' &&
                error.name !== 'NotAllowedError'
              ) {
                console.error('Error playing video:', error);
              }
            });
          }
        }
      }
    });

    // Clean up map - remove entries for participants that no longer exist
    const participantIds = new Set(participants.map((p) => p.id));
    this.videoElementMap.forEach((element, id) => {
      if (!participantIds.has(id) || !document.contains(element)) {
        this.videoElementMap.delete(id);
      }
    });
  }

  async startCall() {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser._id) {
      console.error('User not authenticated');
      return;
    }

    const success = await this.videoCallService.startVideoCall(
      this.roomId,
      this.participants,
      currentUser._id.toString()
    );
    if (success) {
      const warning = this.videoCallService.getLastWarningMessage();
      if (warning) {
        this.alertService.warningToaster(warning);
      }
    } else {
      const message =
        this.videoCallService.getLastErrorMessage() ||
        'Failed to start video call. Please check your camera and microphone permissions.';
      this.alertService.errorToaster(message);
      this.callEnded.emit();
    }
  }

  endCall() {
    this.videoCallService.endVideoCall();
    this.callEnded.emit();
  }

  async toggleMute() {
    const success = await this.videoCallService.toggleMute();
    if (!success) {
      const message =
        this.videoCallService.getLastErrorMessage() ||
        'Unable to access the microphone. Check your device permissions.';
      this.alertService.errorToaster(message);
    }
  }

  async toggleVideo() {
    const success = await this.videoCallService.toggleVideo();
    if (!success) {
      const message =
        this.videoCallService.getLastErrorMessage() ||
        this.videoCallService.getLastWarningMessage() ||
        'Unable to access the camera. Check your device permissions.';
      this.alertService.errorToaster(message);
    }
  }

  toggleLayout() {
    this.isGridLayout.update((current) => !current);
  }

  selectParticipant(participant: VideoCallParticipant) {
    if (participant.id !== 'local') {
      this.selectedParticipant.set(participant);
      this.isGridLayout.set(false);
    }
  }

  getParticipantClass(participant: VideoCallParticipant): string {
    const classes = ['participant-video'];

    if (participant.isSpeaking) {
      classes.push('speaking');
    }

    if (participant.isMuted) {
      classes.push('muted');
    }

    if (participant.isVideoOff) {
      classes.push('video-off');
    }

    return classes.join(' ');
  }

  getAudioLevel(participant: VideoCallParticipant): number {
    // In a real implementation, this would come from the audio analysis
    return participant.isSpeaking ? Math.random() * 100 : 0;
  }
}
