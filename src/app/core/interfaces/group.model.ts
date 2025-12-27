export interface Group {
  _id: string;
  name: string;
  description: string;
  avatar: string;
  members: User[];
  admins: User[];
  createdBy: User;
  groupType: 'public' | 'private' | 'secret';
  settings: GroupSettings;
  inviteCode?: string;
  inviteExpiry?: Date;
  isActive: boolean;
  lastActivity: Date;
  pinnedMessages: PinnedMessage[];
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  statusMessage?: string;
  lastSeen?: Date;
  unreadCount?: number;
}

export interface GroupSettings {
  allowMemberInvite: boolean;
  allowMemberAdd: boolean;
  allowMessageEdit: boolean;
  allowMessageDelete: boolean;
  allowFileSharing: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
}

export interface PinnedMessage {
  message: {
    _id: string;
    content: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    timestamp: Date;
  };
  pinnedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  pinnedAt: Date;
}
