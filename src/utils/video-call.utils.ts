import { VideoCallParticipant } from '../app/core/services/video-call/video-call.service';

/**
 * Generates CSS classes for a video call participant based on their state.
 * @param participant The video call participant
 * @returns A string of CSS classes
 */
export function getParticipantClass(participant: VideoCallParticipant): string {
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

/**
 * Simulates audio level for a participant.
 * In a real app, this would process audio stream data.
 * @param participant The video call participant
 * @returns A number between 0 and 100 representing audio level
 */
export function getAudioLevel(participant: VideoCallParticipant): number {
  return participant.isSpeaking ? Math.random() * 100 : 0;
}
