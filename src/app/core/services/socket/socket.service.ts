import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SafeStorageService } from '../storage/safe-storage.service';

export interface Message {
  _id: string;
  id?: string;
  content: string;
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
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  messageType:
    | 'text'
    | 'image'
    | 'file'
    | 'voice'
    | 'video'
    | 'location'
    | 'contact'
    | 'system';
  timestamp: Date;
  isRead: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    _id: string;
    content: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
    };
  };
  edited: boolean;
  editedAt?: Date;
  deleted: boolean;
  deletedAt?: Date;
  forwarded: boolean;
  forwardedFrom?: string;
  attachments?: any[];
  reactions: any[];
  status: 'sent' | 'delivered' | 'read';
  readBy: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface OnlineUser {
  userId: string;
  username: string;
  lastSeen: Date;
  isOnline: boolean;
}

export interface ChatRoom {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private authService = inject(AuthService);
  private storageService = inject(SafeStorageService);

  private socket: Socket | null = null;
  private isConnected = signal(false);
  private currentUser = signal<any>(null);

  // Observable streams
  private messageSubject = new BehaviorSubject<Message | null>(null);
  private typingSubject = new BehaviorSubject<TypingUser | null>(null);
  private onlineUsersSubject = new BehaviorSubject<OnlineUser[]>([]);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private processedMessages = new Set<string>(); // Track processed messages

  // Public observables
  public message$ = this.messageSubject.asObservable();
  public typing$ = this.typingSubject.asObservable();
  public onlineUsers$ = this.onlineUsersSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor() {
    this.initializeSocket();
    
    // Listen for token refresh events
    this.authService.getTokenRefreshObservable().subscribe(() => {
      this.reconnectWithNewToken();
    });
  }

  private initializeSocket(): void {
    // Prevent multiple socket connections
    if (this.socket && this.socket.connected) {
      return;
    }

    const token = this.storageService.get('authToken');

    if (!token) {
      // console.log('Socket initialization failed: No token found');
      return;
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    // console.log('Initializing socket connection...');

    // Connect to backend socket server
    this.socket = io('http://localhost:3000', {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      forceNew: true, // Force new connection
      timeout: 20000, // 20 second timeout
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Remove existing event listeners to prevent duplication
    this.socket.removeAllListeners();

    // Connection events
    this.socket.on('connect', () => {
      // console.log('Socket connected successfully');
      this.isConnected.set(true);
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      // console.log('Socket disconnected:', reason);
      this.isConnected.set(false);
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      // console.log('Socket connection error:', error.message);
      this.isConnected.set(false);
      this.connectionStatusSubject.next(false);

      // Handle authentication errors
      if (error.message && error.message.includes('Authentication error')) {
        this.storageService.remove('authToken');
        this.authService.logout();
        window.location.href = '/login';
      }
    });

    // Authentication events
    this.socket.on('authenticated', (user) => {
      this.currentUser.set(user);
    });

    this.socket.on('authentication_error', (error) => {
      // Handle authentication error - token might be expired
      this.storageService.remove('authToken');
      this.authService.logout();
      window.location.href = '/login';
    });

    // Message events
    this.socket.on('message_received', (message: Message) => {
      // console.log('Message received via socket:', message);
      
      // Create a unique key for message deduplication
      const messageKey = `${message._id}_${message.timestamp}_${message.sender._id}`;

      // Check if we've already processed this message
      if (this.processedMessages.has(messageKey)) {
        // console.log('Message already processed, skipping:', messageKey);
        return;
      }

      // Mark message as processed
      this.processedMessages.add(messageKey);

      // Clean up old processed messages (keep only last 100)
      if (this.processedMessages.size > 100) {
        const messagesArray = Array.from(this.processedMessages);
        this.processedMessages.clear();
        messagesArray
          .slice(-50)
          .forEach((key) => this.processedMessages.add(key));
      }

      this.messageSubject.next(message);
    });

    // message_sent event removed - no longer needed since sender receives message via message_received

    this.socket.on('message_updated', (message: Message) => {
      this.messageSubject.next(message);
    });

    this.socket.on('message_deleted', (messageId: string) => {
      // Emit the deleted message ID so chat service can handle it
      this.messageSubject.next({ _id: messageId, deleted: true } as any);
    });

    // Typing events
    this.socket.on('user_typing', (typingData: TypingUser) => {
      this.typingSubject.next(typingData);
    });

    this.socket.on('user_stopped_typing', (typingData: TypingUser) => {
      this.typingSubject.next(typingData);
    });

    // Online status events
    this.socket.on('online_users', (users: OnlineUser[]) => {
      this.onlineUsersSubject.next(users);
    });

    this.socket.on('user_online', (user: OnlineUser) => {
      const currentUsers = this.onlineUsersSubject.value;
      const updatedUsers = currentUsers.filter((u) => u.userId !== user.userId);
      updatedUsers.push(user);
      this.onlineUsersSubject.next(updatedUsers);
    });

    this.socket.on('user_offline', (userId: string) => {
      const currentUsers = this.onlineUsersSubject.value;
      const updatedUsers = currentUsers.map((user) =>
        user.userId === userId
          ? { ...user, isOnline: false, lastSeen: new Date() }
          : user
      );
      this.onlineUsersSubject.next(updatedUsers);
    });

    // Message loading
    this.socket.on('load_messages', (messages: Message[]) => {
      // Emit each message individually to maintain consistency
      messages.forEach((message) => {
        this.messageSubject.next(message);
      });
    });

    // Error handling
    this.socket.on('error', (error) => {
      // Handle socket errors silently
    });
  }

  // Public methods for sending data
  public sendMessage(message: Partial<Message>): void {
    if (!this.socket || !this.isConnected()) {
      // console.log('Cannot send message: Socket not connected');
      return;
    }

    // console.log('Sending message via socket:', message);

    // Extract receiver/group IDs for backend
    const receiverId = message.receiver?._id;
    const groupId = message.group?._id;

    this.socket.emit('send_message', {
      content: message.content,
      receiverId: receiverId,
      groupId: groupId,
      type: message.type || 'text',
      replyTo: message.replyTo?._id,
      timestamp: new Date(),
    });
  }

  public startTyping(receiverId?: string, groupId?: string): void {
    if (!this.socket || !this.isConnected()) return;

    const user = this.currentUser();
    this.socket.emit('start_typing', {
      receiverId,
      groupId,
      userId: user?._id,
      username: user?.username || user?.firstName || 'Unknown User',
    });
  }

  public stopTyping(receiverId?: string, groupId?: string): void {
    if (!this.socket || !this.isConnected()) return;

    const user = this.currentUser();
    this.socket.emit('stop_typing', {
      receiverId,
      groupId,
      userId: user?._id,
      username: user?.username || user?.firstName || 'Unknown User',
    });
  }

  public joinRoom(roomId: string, roomType: 'private' | 'group'): void {
    if (!this.socket || !this.isConnected()) {
      return;
    }

    this.socket.emit('join_room', {
      roomId,
      roomType,
      userId: this.currentUser()?._id,
    });
  }

  public leaveRoom(roomId: string): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit('leave_room', {
      roomId,
      userId: this.currentUser()?._id,
    });
  }

  public markMessageAsRead(messageId: string, roomId: string): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit('mark_message_read', {
      messageId,
      roomId,
      userId: this.currentUser()?._id,
    });
  }

  public updateMessage(messageId: string, content: string): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit('update_message', {
      messageId,
      content,
      userId: this.currentUser()?._id,
    });
  }

  public deleteMessage(messageId: string): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit('delete_message', {
      messageId,
      userId: this.currentUser()?._id,
    });
  }

  public uploadFile(
    file: File,
    roomId: string,
    messageType: 'image' | 'video' | 'audio' | 'file',
    isGroupChat: boolean = false
  ): Observable<any> {
    return new Observable((observer) => {
      if (!this.socket || !this.isConnected()) {
        observer.error('Socket not connected');
        return;
      }

      // Create a unique upload ID
      const uploadId = Date.now().toString();

      // Listen for upload progress
      this.socket.on(`upload_progress_${uploadId}`, (progress) => {
        observer.next({ type: 'progress', progress });
      });

      // Listen for upload completion
      this.socket.on(`upload_complete_${uploadId}`, (result) => {
        observer.next({ type: 'complete', result });
        observer.complete();
      });

      // Listen for upload error
      this.socket.on(`upload_error_${uploadId}`, (error) => {
        observer.error(error);
      });

      // Convert file to base64 for socket transmission
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;

        // Send file upload data

        // Start upload - send file as base64
        this.socket?.emit('upload_file', {
          uploadId,
          fileData: base64Data,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          roomId: roomId,
          messageType: messageType,
          userId: this.currentUser()?._id,
          isGroupChat: isGroupChat,
        });
      };

      reader.onerror = () => {
        observer.error('Failed to read file');
      };

      reader.readAsDataURL(file);
    });
  }

  public getCurrentUser(): any {
    return this.currentUser();
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
      this.connectionStatusSubject.next(false);
    }
  }

  // Method to clear processed messages (useful when switching chats)
  public clearProcessedMessages(): void {
    this.processedMessages.clear();
  }

  public reconnect(): void {
    this.disconnect();
    this.initializeSocket();
  }

  // Reconnect socket with new token when token refreshes
  private reconnectWithNewToken(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.initializeSocket();
  }

  // Check if socket is connected
  public isSocketConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  // Get connection status
  public getConnectionStatus(): boolean {
    return this.isConnected();
  }
}
