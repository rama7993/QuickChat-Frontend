import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import {
  VideoCallService,
  VideoCallParticipant,
} from '../../../core/services/video-call/video-call.service';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-call.component.html',
  styleUrl: './video-call.component.scss',
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @Input() roomId: string = '';
  @Input() participants: string[] = [];
  @Output() callEnded = new EventEmitter<void>();

  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoGrid') videoGridRef!: ElementRef<HTMLDivElement>;

  callState = signal<any>(null);
  participants$!: Observable<VideoCallParticipant[]>;

  isGridLayout = signal(true);
  selectedParticipant = signal<VideoCallParticipant | null>(null);

  constructor(private videoCallService: VideoCallService) {}

  ngOnInit() {
    this.callState.set(this.videoCallService.getCallState());
    this.participants$ = this.videoCallService.participants$;
    this.startCall();
  }

  ngOnDestroy() {
    this.endCall();
  }

  async startCall() {
    const success = await this.videoCallService.startVideoCall(
      this.roomId,
      this.participants
    );
    if (success) {
      // Participants will be added via WebRTC when they join the call
      // console.log('Video call started successfully'); // Commented for production
    }
  }

  endCall() {
    this.videoCallService.endVideoCall();
    this.callEnded.emit();
  }

  toggleMute() {
    this.videoCallService.toggleMute();
  }

  toggleVideo() {
    this.videoCallService.toggleVideo();
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
