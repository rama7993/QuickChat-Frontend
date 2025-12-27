export interface Message {
  _id: string;
  id?: string; // For socket service compatibility
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    photoUrl: string;
    username?: string;
  };
  receiver?: {
    _id: string;
    firstName: string;
    lastName: string;
    photoUrl: string;
    username?: string;
  };
  group?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  type?:
    | 'text'
    | 'image'
    | 'file'
    | 'audio'
    | 'video'
    | 'location'
    | 'contact'
    | 'system';
  messageType:
    | 'text'
    | 'image'
    | 'file'
    | 'voice'
    | 'video'
    | 'location'
    | 'contact'
    | 'system';
  attachments?: Attachment[];
  replyTo?: {
    _id: string;
    content: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
    };
  };
  reactions: Reaction[];
  status: 'sent' | 'delivered' | 'read';
  readBy: ReadBy[];
  edited: boolean;
  editedAt?: Date;
  deleted: boolean;
  deletedAt?: Date;
  forwarded: boolean;
  forwardedFrom?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  isRead?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface Attachment {
  type: 'image' | 'file' | 'voice' | 'video' | 'audio';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  thumbnail?: string;
  duration?: number;
}

export interface Reaction {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  emoji: string;
  timestamp: Date;
}

export interface ReadBy {
  user: string;
  readAt: Date;
}
