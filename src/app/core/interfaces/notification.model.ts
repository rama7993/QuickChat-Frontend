export interface Notification {
  _id: string;
  user: string;
  type:
    | 'message'
    | 'group_invite'
    | 'friend_request'
    | 'group_message'
    | 'message_reaction'
    | 'message_reply'
    | 'group_admin'
    | 'system';
  title: string;
  message: string;
  data: {
    messageId?: string;
    groupId?: {
      _id: string;
      name: string;
      avatar: string;
    };
    senderId?: {
      _id: string;
      firstName: string;
      lastName: string;
      photoUrl: string;
    };
    actionUrl?: string;
    metadata?: any;
  };
  read: boolean;
  readAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundNotifications: boolean;
  messagePreview: boolean;
  groupNotifications: boolean;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}
