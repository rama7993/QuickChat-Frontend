import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  AfterViewChecked,
  signal,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
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
export class VideoCallComponent
  implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked
{
  @Input() roomId: string = '';
  @Input() participants: string[] = [];
  @Output() callEnded = new EventEmitter<void>();

  @ViewChild('videoGrid') videoGridRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('participantVideo') videoElements!: QueryList<
    ElementRef<HTMLVideoElement>
  >;

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
  private attachedStreams = new Set<string>();
  private viewChecked = false;

  ngOnInit() {
    this.participants$ = this.videoCallService.participants$;
    this.startCall();
  }

  ngAfterViewInit() {
    // Subscribe to participants changes
    this.participantsSubscription = this.participants$.subscribe(
      (participants) => {
        // Mark that we need to check the view on next cycle
        this.viewChecked = false;
      }
    );
  }

  ngAfterViewChecked() {
    // Only process if we haven't checked this cycle and there are video elements
    if (
      !this.viewChecked &&
      this.videoElements &&
      this.videoElements.length > 0
    ) {
      this.viewChecked = true;
      // Use setTimeout to break out of the change detection cycle
      setTimeout(() => {
        this.attachStreamsToVideoElements();
      }, 0);
    }
  }

  ngOnDestroy() {
    if (this.participantsSubscription) {
      this.participantsSubscription.unsubscribe();
    }
    this.attachedStreams.clear();
    this.endCall();
  }

  private attachStreamsToVideoElements() {
    if (!this.videoElements || this.videoElements.length === 0) {
      return;
    }

    // Get current participants from the service
    let participants: VideoCallParticipant[] = [];
    this.videoCallService.participants$
      .subscribe((p) => (participants = p))
      .unsubscribe();

    if (participants.length === 0) {
      return;
    }

    this.videoElements.forEach((elementRef) => {
      const videoElement = elementRef.nativeElement;
      const participantId = videoElement.getAttribute('data-participant-id');

      if (!participantId) return;

      const participant = participants.find(
        (p: VideoCallParticipant) => p.id === participantId
      );

      if (participant && participant.stream) {
        const streamKey = `${participantId}-${participant.stream.id}`;

        // Only attach if not already attached
        if (!this.attachedStreams.has(streamKey)) {
          try {
            console.log(
              '[VideoCallComponent] Attaching stream for participant:',
              participantId,
              'stream tracks:',
              participant.stream.getTracks().length
            );
            videoElement.srcObject = participant.stream;
            this.attachedStreams.add(streamKey);

            // Ensure video plays
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log(
                    '[VideoCallComponent] Video playing for participant:',
                    participantId
                  );
                })
                .catch((error) => {
                  if (
                    error.name !== 'AbortError' &&
                    error.name !== 'NotAllowedError'
                  ) {
                    console.warn('Video play error:', error);
                  }
                });
            }
          } catch (error) {
            console.error('Error attaching stream to video element:', error);
          }
        }
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
