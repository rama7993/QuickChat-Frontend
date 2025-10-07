import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface VideoCallParticipant {
  id: string;
  name: string;
  stream: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
}

export interface VideoCallState {
  isActive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  participants: VideoCallParticipant[];
  localStream: MediaStream | null;
  roomId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class VideoCallService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannel: RTCDataChannel | null = null;

  private callState = signal<VideoCallState>({
    isActive: false,
    isMuted: false,
    isVideoOff: false,
    participants: [],
    localStream: null,
    roomId: null,
  });

  private participantsSubject = new BehaviorSubject<VideoCallParticipant[]>([]);
  public participants$ = this.participantsSubject.asObservable();

  constructor() {}

  getCallState() {
    return this.callState.asReadonly();
  }

  async startVideoCall(
    roomId: string,
    participants: string[]
  ): Promise<boolean> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Update call state
      this.callState.update((state) => ({
        ...state,
        isActive: true,
        localStream: this.localStream,
        roomId: roomId,
      }));

      // Add local participant
      const localParticipant: VideoCallParticipant = {
        id: 'local',
        name: 'You',
        stream: this.localStream,
        isMuted: false,
        isVideoOff: false,
        isSpeaking: false,
      };

      this.addParticipant(localParticipant);

      // Initialize audio level monitoring
      this.monitorAudioLevels();

      return true;
    } catch (error) {
      console.error('Error starting video call:', error);
      return false;
    }
  }

  async joinVideoCall(roomId: string): Promise<boolean> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Update call state
      this.callState.update((state) => ({
        ...state,
        isActive: true,
        localStream: this.localStream,
        roomId: roomId,
      }));

      // Add local participant
      const localParticipant: VideoCallParticipant = {
        id: 'local',
        name: 'You',
        stream: this.localStream,
        isMuted: false,
        isVideoOff: false,
        isSpeaking: false,
      };

      this.addParticipant(localParticipant);

      // Initialize audio level monitoring
      this.monitorAudioLevels();

      return true;
    } catch (error) {
      console.error('Error joining video call:', error);
      return false;
    }
  }

  endVideoCall(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connections
    this.peerConnections.forEach((connection) => {
      connection.close();
    });
    this.peerConnections.clear();

    // Reset call state
    this.callState.set({
      isActive: false,
      isMuted: false,
      isVideoOff: false,
      participants: [],
      localStream: null,
      roomId: null,
    });

    this.participantsSubject.next([]);
  }

  toggleMute(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.callState.update((state) => ({
          ...state,
          isMuted: !audioTrack.enabled,
        }));

        // Update local participant
        this.updateLocalParticipant({ isMuted: !audioTrack.enabled });
      }
    }
  }

  toggleVideo(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.callState.update((state) => ({
          ...state,
          isVideoOff: !videoTrack.enabled,
        }));

        // Update local participant
        this.updateLocalParticipant({ isVideoOff: !videoTrack.enabled });
      }
    }
  }

  private addParticipant(participant: VideoCallParticipant): void {
    const currentParticipants = this.participantsSubject.value;
    const existingIndex = currentParticipants.findIndex(
      (p) => p.id === participant.id
    );

    if (existingIndex >= 0) {
      currentParticipants[existingIndex] = participant;
    } else {
      currentParticipants.push(participant);
    }

    this.participantsSubject.next([...currentParticipants]);
  }

  private updateLocalParticipant(updates: Partial<VideoCallParticipant>): void {
    const currentParticipants = this.participantsSubject.value;
    const localIndex = currentParticipants.findIndex((p) => p.id === 'local');

    if (localIndex >= 0) {
      currentParticipants[localIndex] = {
        ...currentParticipants[localIndex],
        ...updates,
      };
      this.participantsSubject.next([...currentParticipants]);
    }
  }

  private monitorAudioLevels(): void {
    if (!this.localStream) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(this.localStream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    microphone.connect(analyser);
    analyser.fftSize = 256;

    const checkAudioLevel = () => {
      if (!this.callState().isActive) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeaking = average > 30; // Threshold for speaking detection

      this.updateLocalParticipant({ isSpeaking });

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  // Add remote participants from WebRTC
  addRemoteParticipant(id: string, name: string, stream: MediaStream): void {
    const remoteParticipant: VideoCallParticipant = {
      id,
      name,
      stream: stream, // Actual remote stream from WebRTC
      isMuted: false,
      isVideoOff: false,
      isSpeaking: false,
    };

    this.addParticipant(remoteParticipant);
  }

  removeParticipant(id: string): void {
    const currentParticipants = this.participantsSubject.value;
    const filteredParticipants = currentParticipants.filter((p) => p.id !== id);
    this.participantsSubject.next(filteredParticipants);
  }
}
