import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Message } from '../../interfaces/message.model';
import {
  SocketService,
  Message as SocketMessage,
  TypingUser,
} from '../socket/socket.service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  private socketService = inject(SocketService);

  // Real-time message streams
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private typingUsersSubject = new BehaviorSubject<TypingUser[]>([]);
  private currentChatSubject = new BehaviorSubject<string | null>(null);
  private processedMessageIds = new Set<string>();

  public messages$ = this.messagesSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();
  public currentChat$ = this.currentChatSubject.asObservable();

  // Method to clear messages when switching chats
  public clearMessages(): void {
    this.messagesSubject.next([]);
    this.processedMessageIds.clear();
    // Also clear socket service processed messages
    this.socketService.clearProcessedMessages();
  }

  constructor(private http: HttpClient) {
    this.initializeSocketListeners();
  }

  private initializeSocketListeners(): void {
    // Listen for new messages
    this.socketService.message$.subscribe((socketMessage) => {
      if (socketMessage) {
        // console.log('Chat service received message:', socketMessage);

        // Handle message deletion
        if ((socketMessage as any).deleted) {
          const messageId = socketMessage._id;
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.filter(
            (msg) => msg._id !== messageId
          );
          this.messagesSubject.next(updatedMessages);
          return;
        }

        // Convert socket message to chat service message format
        const message: Message = {
          _id: socketMessage._id,
          id: socketMessage.id,
          sender: socketMessage.sender,
          receiver: socketMessage.receiver,
          group: socketMessage.group,
          content: socketMessage.content,
          type: socketMessage.type,
          messageType: socketMessage.messageType,
          attachments: socketMessage.attachments || [],
          replyTo: socketMessage.replyTo,
          reactions: socketMessage.reactions || [],
          status: socketMessage.status || 'sent',
          readBy: socketMessage.readBy || [],
          edited: socketMessage.edited || false,
          editedAt: socketMessage.editedAt,
          deleted: socketMessage.deleted || false,
          deletedAt: socketMessage.deletedAt,
          forwarded: socketMessage.forwarded || false,
          forwardedFrom: socketMessage.forwardedFrom,
          timestamp: socketMessage.timestamp,
          createdAt: socketMessage.createdAt || socketMessage.timestamp,
          updatedAt: socketMessage.updatedAt || socketMessage.timestamp,
          isRead: socketMessage.isRead || false,
          fileUrl: socketMessage.fileUrl,
          fileName: socketMessage.fileName,
          fileSize: socketMessage.fileSize,
        };

        const currentMessages = this.messagesSubject.value;

        // Check if message already exists to prevent duplicates
        const messageKey = `${message._id}_${message.timestamp}_${message.sender._id}`;

        if (this.processedMessageIds.has(messageKey)) {
          console.log('Message already processed, skipping:', messageKey);
          return;
        }

        // Additional check for messages already in the array (backup safety)
        const messageExists = currentMessages.some(
          (existingMessage) => existingMessage._id === message._id
        );

        if (messageExists) {
          console.log(
            'Message already exists in array, skipping:',
            message._id
          );
          return;
        }

        // Mark message as processed
        this.processedMessageIds.add(messageKey);

        // Clean up old processed messages (keep only last 100)
        if (this.processedMessageIds.size > 100) {
          const messageKeys = Array.from(this.processedMessageIds);
          this.processedMessageIds.clear();
          messageKeys
            .slice(-50)
            .forEach((key) => this.processedMessageIds.add(key));
        }

        // Add message to the array and sort by timestamp
        const updatedMessages = [...currentMessages, message].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // console.log('Adding message to chat service. Total messages:', updatedMessages.length);
        this.messagesSubject.next(updatedMessages);
      }
    });

    // Listen for typing indicators
    this.socketService.typing$.subscribe((typingData) => {
      if (typingData) {
        const currentTypingUsers = this.typingUsersSubject.value;
        const existingUserIndex = currentTypingUsers.findIndex(
          (u) => u.userId === typingData.userId
        );

        if (typingData.isTyping) {
          if (existingUserIndex >= 0) {
            currentTypingUsers[existingUserIndex] = typingData;
          } else {
            currentTypingUsers.push(typingData);
          }
        } else {
          if (existingUserIndex >= 0) {
            currentTypingUsers.splice(existingUserIndex, 1);
          }
        }

        this.typingUsersSubject.next([...currentTypingUsers]);
      }
    });
  }

  // Get all users
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  // Get private messages with pagination
  getPrivateMessages(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Observable<Message[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<Message[]>(
      `${this.apiUrl}/messages/private/${userId}`,
      { params }
    );
  }

  // Get group messages with pagination
  getGroupMessages(
    groupId: string,
    page: number = 1,
    limit: number = 50
  ): Observable<Message[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<Message[]>(
      `${this.apiUrl}/messages/group/${groupId}`,
      { params }
    );
  }

  // Send private message (real-time)
  sendPrivateMessage(
    receiverId: string,
    content: string,
    replyTo?: string,
    fileUrl?: string,
    fileType?: string
  ): void {
    this.socketService.sendMessage({
      content,
      receiver: {
        _id: receiverId,
        firstName: '',
        lastName: '',
        photoUrl: '',
        username: '',
      },
      type:
        (fileType as 'text' | 'image' | 'video' | 'audio' | 'file') || 'text',
      fileUrl: fileUrl,
      replyTo: replyTo
        ? {
            _id: replyTo,
            content: '',
            sender: { _id: '', firstName: '', lastName: '' },
          }
        : undefined,
    });
  }

  // Send group message (real-time)
  sendGroupMessage(
    groupId: string,
    content: string,
    replyTo?: string,
    fileUrl?: string,
    fileType?: string
  ): void {
    this.socketService.sendMessage({
      content,
      group: { _id: groupId, name: '', avatar: '' },
      type:
        (fileType as 'text' | 'image' | 'video' | 'audio' | 'file') || 'text',
      fileUrl: fileUrl,
      replyTo: replyTo
        ? {
            _id: replyTo,
            content: '',
            sender: { _id: '', firstName: '', lastName: '' },
          }
        : undefined,
    });
  }

  // Upload file and send message (real-time)
  uploadFile(
    file: File,
    receiverId?: string,
    groupId?: string,
    content?: string,
    replyTo?: string
  ): Observable<any> {
    const messageType = this.getFileMessageType(file.type);
    const roomId = receiverId || groupId;
    const isGroupChat = !!groupId;

    if (!roomId) {
      throw new Error('Either receiverId or groupId must be provided');
    }

    return this.socketService.uploadFile(
      file,
      roomId,
      messageType,
      isGroupChat
    );
  }

  // Add reaction to message
  addReaction(messageId: string, emoji: string): Observable<Message> {
    return this.http.post<Message>(
      `${this.apiUrl}/messages/${messageId}/reaction`,
      {
        emoji,
      }
    );
  }

  // Edit message (real-time)
  editMessage(messageId: string, content: string): void {
    this.socketService.updateMessage(messageId, content);
  }

  // Delete message (real-time)
  deleteMessage(messageId: string): void {
    this.socketService.deleteMessage(messageId);
  }

  // Real-time chat management
  joinChat(chatId: string, chatType: 'private' | 'group'): void {
    this.socketService.joinRoom(chatId, chatType);
    this.currentChatSubject.next(chatId);
  }

  leaveChat(chatId: string): void {
    this.socketService.leaveRoom(chatId);
    this.currentChatSubject.next(null);
  }

  // Typing indicators
  startTyping(receiverId?: string, groupId?: string): void {
    this.socketService.startTyping(receiverId, groupId);
  }

  stopTyping(receiverId?: string, groupId?: string): void {
    this.socketService.stopTyping(receiverId, groupId);
  }

  // Mark message as read
  markMessageAsRead(messageId: string, roomId: string): void {
    this.socketService.markMessageAsRead(messageId, roomId);
  }

  // Helper method to determine file message type
  private getFileMessageType(
    mimeType: string
  ): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  // Get current messages
  getCurrentMessages(): Message[] {
    return this.messagesSubject.value;
  }

  // Get current typing users
  getCurrentTypingUsers(): TypingUser[] {
    return this.typingUsersSubject.value;
  }

  // Search messages
  searchMessages(
    query: string,
    groupId?: string,
    userId?: string
  ): Observable<Message[]> {
    let params = new HttpParams().set('query', query);
    if (groupId) params = params.set('groupId', groupId);
    if (userId) params = params.set('userId', userId);

    return this.http.get<Message[]>(`${this.apiUrl}/messages/search/${query}`, {
      params,
    });
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get file type icon
  getFileTypeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'pi pi-image';
    if (mimeType.startsWith('video/')) return 'pi pi-video';
    if (mimeType.startsWith('audio/')) return 'pi pi-volume-up';
    if (mimeType.includes('pdf')) return 'pi pi-file-pdf';
    if (mimeType.includes('word')) return 'pi pi-file-word';
    if (mimeType.includes('excel')) return 'pi pi-file-excel';
    if (mimeType.includes('powerpoint')) return 'pi pi-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('rar'))
      return 'pi pi-file-archive';
    return 'pi pi-file';
  }

  // Check if file is image
  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  // Check if file is video
  isVideoFile(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  // Check if file is audio
  isAudioFile(mimeType: string): boolean {
    return mimeType.startsWith('audio/');
  }

  // Get message status icon
  getMessageStatusIcon(status: string): string {
    switch (status) {
      case 'sent':
        return 'pi pi-check';
      case 'delivered':
        return 'pi pi-check-circle';
      case 'read':
        return 'pi pi-check-circle text-blue-500';
      default:
        return 'pi pi-clock';
    }
  }

  // Format timestamp
  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours =
      (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      // 7 days
      return messageTime.toLocaleDateString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return messageTime.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  // Group messages by date
  groupMessagesByDate(
    messages: Message[]
  ): { date: string; messages: Message[] }[] {
    const grouped: { [key: string]: Message[] } = {};

    messages.forEach((message) => {
      const date = new Date(message.timestamp).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });

    return Object.keys(grouped).map((date) => ({
      date,
      messages: grouped[date],
    }));
  }
}
