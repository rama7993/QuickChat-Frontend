/**
 * Message Utility Functions
 * Helper functions for message operations and formatting
 */

import { Message } from '../app/core/interfaces/message.model';

/**
 * Format message timestamp
 */
export function formatMessageTime(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format message date for grouping
 */
export function formatMessageDate(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Group messages by date
 */
export function groupMessagesByDate(
  messages: Message[]
): { date: string; messages: Message[] }[] {
  const grouped = new Map<string, Message[]>();

  messages.forEach((message) => {
    const date = formatMessageDate(message.timestamp || message.createdAt);
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(message);
  });

  return Array.from(grouped.entries()).map(([date, messages]) => ({
    date,
    messages: messages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt).getTime();
      const timeB = new Date(b.timestamp || b.createdAt).getTime();
      return timeA - timeB;
    }),
  }));
}

/**
 * Check if message is from current user
 */
export function isOwnMessage(message: Message, currentUserId: string): boolean {
  return (
    message.sender._id === currentUserId ||
    message.sender._id.toString() === currentUserId
  );
}

/**
 * Get message preview text
 */
export function getMessagePreview(message: Message): string {
  if (message.deleted) return 'This message was deleted';
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    const emoji =
      {
        image: '📷',
        video: '🎥',
        audio: '🎤',
        voice: '🎤',
        file: '📄',
      }[attachment.type] || '📎';
    return `${emoji} ${attachment.filename || 'Attachment'}`;
  }

  // Handle message type for voice messages
  if (message.messageType === 'voice') {
    return '🎤 Voice message';
  }
  return message.content || '';
}

/**
 * Format duration for voice messages
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
