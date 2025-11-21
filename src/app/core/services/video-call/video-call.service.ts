import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SocketService } from '../socket/socket.service';

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
  private socketService = inject(SocketService);
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannel: RTCDataChannel | null = null;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private lastErrorMessage = signal('');
  private lastWarningMessage = signal('');

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

  constructor() {
    // Setup socket listeners when socket is available
    this.socketService.connectionStatus$.subscribe((isConnected) => {
      if (isConnected) {
        this.setupSocketListeners();
      }
    });
  }

  private setupSocketListeners(): void {
    const socket = this.socketService['socket'];
    if (!socket) {
      // Retry after a short delay if socket is not ready
      setTimeout(() => this.setupSocketListeners(), 1000);
      return;
    }

    // Remove existing listeners to avoid duplicates
    socket.off('video_call_offer');
    socket.off('video_call_answer');
    socket.off('video_call_ice_candidate');
    socket.off('video_call_ended');

    // Listen for video call offer
    socket.on('video_call_offer', async (data: any) => {
      await this.handleVideoCallOffer(data);
    });

    // Listen for video call answer
    socket.on('video_call_answer', async (data: any) => {
      await this.handleVideoCallAnswer(data);
    });

    // Listen for ICE candidates
    socket.on('video_call_ice_candidate', async (data: any) => {
      await this.handleIceCandidate(data);
    });

    // Listen for call end
    socket.on('video_call_ended', (data: any) => {
      this.endVideoCall();
    });
  }

  private async handleVideoCallOffer(data: any): Promise<void> {
    // Handle incoming call offer
    if (!this.localStream) {
      try {
        this.clearDeviceMessages();
        this.localStream = await this.requestMediaStream();
      } catch (error) {
        console.error('Error initializing local stream for incoming call:', error);
        this.setErrorMessage(this.mapMediaError(error));
        return;
      }

      // Update call state
      this.callState.update((state) => ({
        ...state,
        isActive: true,
        localStream: this.localStream,
        roomId: data.roomId,
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
      this.monitorAudioLevels();
    }

    // Create peer connection for the caller
    const peerConnection = await this.createPeerConnection(
      data.roomId,
      data.callerId,
      false
    );

    if (peerConnection) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back
      const socket = this.socketService['socket'];
      if (socket) {
        socket.emit('video_call_answer', {
          roomId: data.roomId,
          answer,
          receiverId: data.callerId,
        });
      }
    }
  }

  private async handleVideoCallAnswer(data: any): Promise<void> {
    // Handle call answer
    const peerConnection = this.peerConnections.get(data.receiverId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    }
  }

  private async handleIceCandidate(data: any): Promise<void> {
    // Handle ICE candidate
    const peerConnection = this.peerConnections.get(
      data.senderId || data.receiverId
    );
    if (peerConnection && data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  getCallState() {
    return this.callState.asReadonly();
  }

  async startVideoCall(
    roomId: string,
    participants: string[],
    currentUserId: string
  ): Promise<boolean> {
    try {
      this.clearDeviceMessages();
      this.releaseLocalStream();
      this.currentRoomId = roomId;
      this.currentUserId = currentUserId;

      // Get user media
      this.localStream = await this.requestMediaStream();

      const hasVideoTrack = this.localStream.getVideoTracks().length > 0;
      const hasAudioTrack = this.localStream.getAudioTracks().length > 0;

      // Update call state
      this.callState.update((state) => ({
        ...state,
        isActive: true,
        isVideoOff: !hasVideoTrack,
        isMuted: !hasAudioTrack,
        localStream: this.localStream,
        roomId: roomId,
      }));

      // Add local participant
      const localParticipant: VideoCallParticipant = {
        id: 'local',
        name: 'You',
        stream: this.localStream,
        isMuted: !hasAudioTrack,
        isVideoOff: !hasVideoTrack,
        isSpeaking: false,
      };

      this.addParticipant(localParticipant);

      // Initialize WebRTC connections for each participant
      for (const participantId of participants) {
        if (participantId !== currentUserId) {
          await this.createPeerConnection(roomId, participantId, true);
        }
      }

      // Initialize audio level monitoring
      this.monitorAudioLevels();

      return true;
    } catch (error) {
      console.error('Error starting video call:', error);
      this.setErrorMessage(this.mapMediaError(error));
      this.releaseLocalStream();
      return false;
    }
  }

  private async createPeerConnection(
    roomId: string,
    remoteUserId: string,
    isCaller: boolean
  ): Promise<RTCPeerConnection> {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnections.set(remoteUserId, peerConnection);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.addRemoteParticipant(remoteUserId, 'Remote User', remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = this.socketService['socket'];
        if (socket) {
          socket.emit('video_call_ice_candidate', {
            roomId,
            candidate: event.candidate,
            receiverId: remoteUserId,
          });
        }
      }
    };

    // Create and send offer if caller
    if (isCaller) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const socket = this.socketService['socket'];
      if (socket) {
        socket.emit('video_call_offer', {
          roomId,
          offer,
          callerId: this.currentUserId,
          receiverId: remoteUserId,
        });
      }
    }

    return peerConnection;
  }

  async joinVideoCall(roomId: string): Promise<boolean> {
    try {
      this.clearDeviceMessages();
      this.releaseLocalStream();
      // Get user media
      this.localStream = await this.requestMediaStream();

      const hasVideoTrack = this.localStream.getVideoTracks().length > 0;
      const hasAudioTrack = this.localStream.getAudioTracks().length > 0;

      // Update call state
      this.callState.update((state) => ({
        ...state,
        isActive: true,
        isVideoOff: !hasVideoTrack,
        isMuted: !hasAudioTrack,
        localStream: this.localStream,
        roomId: roomId,
      }));

      // Add local participant
      const localParticipant: VideoCallParticipant = {
        id: 'local',
        name: 'You',
        stream: this.localStream,
        isMuted: !hasAudioTrack,
        isVideoOff: !hasVideoTrack,
        isSpeaking: false,
      };

      this.addParticipant(localParticipant);

      // Initialize audio level monitoring
      this.monitorAudioLevels();

      return true;
    } catch (error) {
      console.error('Error joining video call:', error);
      this.setErrorMessage(this.mapMediaError(error));
      this.releaseLocalStream();
      return false;
    }
  }

  endVideoCall(): void {
    // Emit call end event
    if (this.currentRoomId && this.currentUserId) {
      const socket = this.socketService['socket'];
      if (socket) {
        socket.emit('video_call_end', {
          roomId: this.currentRoomId,
          userId: this.currentUserId,
        });
      }
    }

    // Stop local stream
    this.releaseLocalStream();

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
    this.currentRoomId = null;
    this.currentUserId = null;
  }

  async toggleMute(): Promise<boolean> {
    if (!this.localStream) {
      this.setErrorMessage(
        'Microphone is not initialized. Please rejoin the call and allow microphone access.'
      );
      return false;
    }

    let audioTrack = this.localStream.getAudioTracks()[0];

    if (!audioTrack) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          this.localStream.addTrack(audioTrack);
          this.attachTrackToPeers(audioTrack);
          this.callState.update((state) => ({
            ...state,
            isMuted: false,
          }));
          this.updateLocalParticipant({
            isMuted: false,
            stream: this.localStream,
          });
          this.clearDeviceMessages();
          return true;
        }
      } catch (error) {
        this.setErrorMessage(this.mapMediaError(error));
      }
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    this.callState.update((state) => ({
      ...state,
      isMuted: !audioTrack.enabled,
    }));

    this.updateLocalParticipant({ isMuted: !audioTrack.enabled });
    this.clearDeviceMessages();
    return true;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.localStream) {
      this.setErrorMessage(
        'Camera is not initialized. Please rejoin the call and allow camera access.'
      );
      return false;
    }

    let videoTrack = this.localStream.getVideoTracks()[0];

    if (!videoTrack) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          this.localStream.addTrack(videoTrack);
          this.attachTrackToPeers(videoTrack);
          this.callState.update((state) => ({
            ...state,
            isVideoOff: false,
          }));
          this.updateLocalParticipant({
            isVideoOff: false,
            stream: this.localStream,
          });
          this.clearDeviceMessages();
          return true;
        }
      } catch (error) {
        this.setErrorMessage(this.mapMediaError(error));
      }
      return false;
    }

    videoTrack.enabled = !videoTrack.enabled;
    this.callState.update((state) => ({
      ...state,
      isVideoOff: !videoTrack.enabled,
    }));

    this.updateLocalParticipant({ isVideoOff: !videoTrack.enabled });
    this.clearDeviceMessages();
    return true;
  }

  private attachTrackToPeers(track: MediaStreamTrack): void {
    this.peerConnections.forEach((connection) => {
      const sender = connection
        .getSenders()
        .find((s) => s.track && s.track.kind === track.kind);

      if (sender) {
        sender.replaceTrack(track);
      } else if (this.localStream) {
        connection.addTrack(track, this.localStream);
      }
    });
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
    if (
      !this.localStream ||
      this.localStream.getAudioTracks().length === 0
    )
      return;

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

  getLastErrorMessage(): string {
    return this.lastErrorMessage();
  }

  getLastWarningMessage(): string {
    return this.lastWarningMessage();
  }

  getErrorMessageSignal() {
    return this.lastErrorMessage.asReadonly();
  }

  getWarningMessageSignal() {
    return this.lastWarningMessage.asReadonly();
  }

  private setErrorMessage(message: string) {
    this.lastErrorMessage.set(message);
  }

  private setWarningMessage(message: string) {
    this.lastWarningMessage.set(message);
  }

  private clearDeviceMessages() {
    this.lastErrorMessage.set('');
    this.lastWarningMessage.set('');
  }

  private releaseLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  private async requestMediaStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: { width: 1280, height: 720 },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.clearDeviceMessages();
      return stream;
    } catch (error) {
      const fallbackStream = await this.tryFallbackMedia();
      if (fallbackStream) {
        return fallbackStream;
      }
      throw error;
    }
  }

  private async tryFallbackMedia(): Promise<MediaStream | null> {
    const combinedStream = new MediaStream();
    let hasTrack = false;
    const warnings: string[] = [];

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });
      videoStream
        .getVideoTracks()
        .forEach((track) => combinedStream.addTrack(track));
      hasTrack = hasTrack || videoStream.getVideoTracks().length > 0;
    } catch (error) {
      warnings.push('Camera unavailable');
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStream
        .getAudioTracks()
        .forEach((track) => combinedStream.addTrack(track));
      hasTrack = hasTrack || audioStream.getAudioTracks().length > 0;
    } catch (error) {
      warnings.push('Microphone unavailable');
    }

    if (hasTrack) {
      if (warnings.length) {
        this.lastWarningMessage.set(
          `${warnings.join(
            ' and '
          )}. You can continue the call with the available device.`
        );
      } else {
        this.clearDeviceMessages();
      }
      return combinedStream;
    }

    return null;
  }

  private mapMediaError(error: unknown): string {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return 'Camera or microphone access was denied. Please allow permissions in your browser/system settings and retry.';
        case 'NotReadableError':
          return 'We could not access your camera or microphone. Check if another browser tab, video app, or OS privacy setting is blocking the device, then try again.';
        case 'NotFoundError':
          return 'No compatible camera or microphone was found. Please connect a device and try again.';
        case 'OverconstrainedError':
          return 'Your camera does not support the requested resolution. Please switch to a different device.';
        default:
          return error.message || 'Unable to start video call due to an unknown error.';
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to start video call. Please check your devices and try again.';
  }
}
