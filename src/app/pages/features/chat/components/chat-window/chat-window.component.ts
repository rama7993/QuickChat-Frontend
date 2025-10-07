import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
// import { PickerModule } from '@ctrl/ngx-emoji-mart/ngx-emoji';
import { ChatService } from '../../../../../core/services/chat/chat.service';
import { GroupService } from '../../../../../core/services/group/group.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { SocketService } from '../../../../../core/services/socket/socket.service';
import { User, Group } from '../../../../../core/interfaces/group.model';
import { Message } from '../../../../../core/interfaces/message.model';
import { FileUploadComponent } from '../../../../../shared/components/file-upload/file-upload.component';
import { VideoCallComponent } from '../../../../../shared/components/video-call/video-call.component';
import {
  VoiceRecorderComponent,
  VoiceRecordingResult,
} from '../../../../../shared/components/voice-recorder/voice-recorder.component';
import { Default_Img_Url } from '../../../../../../utils/constants.utils';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // PickerModule,
    FileUploadComponent,
    VideoCallComponent,
    VoiceRecorderComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild(FileUploadComponent) fileUploadComponent!: FileUploadComponent;
  @ViewChild(VoiceRecorderComponent)
  voiceRecorderComponent!: VoiceRecorderComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private groupService = inject(GroupService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);

  // Real-time message and typing streams
  private messageSubscription?: Subscription;
  private typingSubscription?: Subscription;
  private connectionSubscription?: Subscription;

  public currentUser = this.authService.currentUser;
  public defaultAvatar = Default_Img_Url;

  // Real-time data
  public messages = signal<Message[]>([]);
  public typingUsers = signal<any[]>([]);
  public isTyping = signal(false);
  public isSocketConnected = signal(false);

  // Chat state
  public selectedUser = signal<User | null>(null);
  public selectedGroup = signal<Group | null>(null);
  public groupedMessages = signal<{ date: string; messages: Message[] }[]>([]);
  public messageText = signal('');
  public isSending = signal(false);
  public isLoading = signal(false);
  public showEmojiPicker = signal(false);
  public showFileUpload = signal(false);
  public showVoiceRecording = signal(false);
  public replyToMessage = signal<Message | null>(null);

  // Media preview signals
  public showImagePreview = signal(false);
  public showVideoPreview = signal(false);
  public previewImageUrl = signal<string>('');
  public previewVideoUrl = signal<string>('');

  // Audio playback state
  private audioElements = new Map<string, HTMLAudioElement>();
  private audioProgress = new Map<string, number>();

  // Emoji list for the picker
  public emojiList = [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '😂',
    '🤣',
    '😊',
    '😇',
    '🙂',
    '🙃',
    '😉',
    '😌',
    '😍',
    '🥰',
    '😘',
    '😗',
    '😙',
    '😚',
    '😋',
    '😛',
    '😝',
    '😜',
    '🤪',
    '🤨',
    '🧐',
    '🤓',
    '😎',
    '🤩',
    '🥳',
    '😏',
    '😒',
    '😞',
    '😔',
    '😟',
    '😕',
    '🙁',
    '☹️',
    '😣',
    '😖',
    '😫',
    '😩',
    '🥺',
    '😢',
    '😭',
    '😤',
    '😠',
    '😡',
    '🤬',
    '🤯',
    '😳',
    '🥵',
    '🥶',
    '😱',
    '😨',
    '😰',
    '😥',
    '😓',
    '🤗',
    '🤔',
    '🤭',
    '🤫',
    '🤥',
    '😶',
    '😐',
    '😑',
    '😬',
    '🙄',
    '😯',
    '😦',
    '😧',
    '😮',
    '😲',
    '🥱',
    '😴',
    '🤤',
    '😪',
    '😵',
    '🤐',
    '🥴',
    '🤢',
    '🤮',
    '🤧',
    '😷',
    '🤒',
    '🤕',
    '🤑',
    '🤠',
    '😈',
    '👿',
    '👹',
    '👺',
    '🤡',
    '💩',
    '👻',
    '💀',
    '☠️',
    '👽',
    '👾',
    '🤖',
    '🎃',
    '😺',
    '😸',
    '😹',
    '😻',
    '😼',
    '😽',
    '🙀',
    '😿',
    '😾',
    '👶',
    '🧒',
    '👦',
    '👧',
    '🧑',
    '👨',
    '👩',
    '🧓',
    '👴',
    '👵',
    '👤',
    '👥',
    '🫂',
    '👪',
    '👨‍👩‍👧‍👦',
    '👨‍👨‍👧',
    '👩‍👩‍👧',
    '👨‍👧',
    '👨‍👧‍👦',
    '👩‍👦',
    '👩‍👦‍👦',
    '👨‍👩‍👧',
    '👨‍👨‍👦',
    '👩‍👩‍👦',
    '👨‍👦',
    '👨‍👦‍👦',
    '👩‍👧',
    '👩‍👧‍👦',
    '👨‍👩‍👦‍👦',
    '👍',
    '👎',
    '👌',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🖖',
    '👏',
    '🙌',
    '👐',
    '🤲',
    '🤝',
    '🙏',
    '✍️',
    '💅',
    '🤳',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🦶',
    '👂',
    '🦻',
    '👃',
    '🧠',
    '🦷',
    '🦴',
    '👀',
    '👁️',
    '👅',
    '👄',
    '💋',
    '🩸',
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '☮️',
    '✝️',
    '☪️',
    '🕉️',
    '☸️',
    '✡️',
    '🔯',
    '🕎',
    '☯️',
    '☦️',
    '🛐',
    '⛎',
    '♈',
    '♉',
    '♊',
    '♋',
    '♌',
    '♍',
    '♎',
    '♏',
    '♐',
    '♑',
    '♒',
    '♓',
    '🆔',
    '⚛️',
    '🉑',
    '☢️',
    '☣️',
    '📴',
    '📳',
    '🈶',
    '🈚',
    '🈸',
    '🈺',
    '🈷️',
    '✴️',
    '🆚',
    '💮',
    '🉐',
    '㊙️',
    '㊗️',
    '🈴',
    '🈵',
    '🈹',
    '🈲',
    '🅰️',
    '🅱️',
    '🆎',
    '🆑',
    '🅾️',
    '🆘',
    '❌',
    '⭕',
    '🛑',
    '⛔',
    '📛',
    '🚫',
    '💯',
    '💢',
    '♨️',
    '🚷',
    '🚯',
    '🚳',
    '🚱',
    '🔞',
    '📵',
    '🚭',
    '❗',
    '❕',
    '❓',
    '❔',
    '‼️',
    '⁉️',
    '🔅',
    '🔆',
    '〽️',
    '⚠️',
    '🚸',
    '🔱',
    '⚜️',
    '🔰',
    '♻️',
    '✅',
    '🈯',
    '💹',
    '❇️',
    '✳️',
    '❎',
    '🌐',
    '💠',
    'Ⓜ️',
    '🌀',
    '💤',
    '🏧',
    '🚾',
    '♿',
    '🅿️',
    '🛗',
    '🈳',
    '🈂️',
    '🛂',
    '🛃',
    '🛄',
    '🛅',
    '🚹',
    '🚺',
    '🚼',
    '⚧️',
    '🚻',
    '🚮',
    '🎦',
    '📶',
    '🈁',
    '🔣',
    '🔤',
    'ℹ️',
    '🔡',
    '🔠',
    '🆖',
    '🆗',
    '🆙',
    '🆒',
    '🆕',
    '🆓',
    '0️⃣',
    '1️⃣',
    '2️⃣',
    '3️⃣',
    '4️⃣',
    '5️⃣',
    '6️⃣',
    '7️⃣',
    '8️⃣',
    '9️⃣',
    '🔟',
  ];

  // Voice recording
  public isRecording = signal(false);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  public recordingTime = signal('00:00');
  private recordingInterval: any = null;

  // Video call
  public showVideoCall = signal(false);
  public videoCallRoomId = signal('');
  public videoCallParticipants = signal<string[]>([]);

  // Message search
  public showMessageSearch = signal(false);
  public searchQuery = signal('');
  public searchResults = signal<Message[]>([]);

  // UI state
  public isMobile = signal(false);
  public showGroupInfo = signal(false);
  public showMessageOptions = signal<string | null>(null);

  private subscriptions: Subscription[] = [];
  private typingTimeout: any;
  private activeRoomId = '';

  public chatTitle = computed(() => {
    if (this.selectedGroup()) {
      return this.selectedGroup()!.name;
    }
    if (this.selectedUser()) {
      return `${this.selectedUser()!.firstName} ${
        this.selectedUser()!.lastName
      }`;
    }
    return 'Select a chat';
  });

  public chatSubtitle = computed(() => {
    if (this.selectedGroup()) {
      const memberCount = this.selectedGroup()!.members.length;
      return `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    }
    if (this.selectedUser()) {
      const user = this.selectedUser()!;
      if (user.status === 'online') {
        return 'Online';
      } else if (user.lastSeen) {
        return `Last seen ${this.formatLastSeen(user.lastSeen)}`;
      }
      return 'Offline';
    }
    return '';
  });

  public isGroupChat = computed(() => !!this.selectedGroup());
  public canSendMessage = computed(
    () => this.messageText().trim().length > 0 && !this.isSending()
  );

  ngOnInit() {
    this.checkScreenSize();
    this.setupRouteParams();
    this.setupSocketListeners();
    this.initializeRealTimeSubscriptions();
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.activeRoomId) {
      this.socketService.leaveRoom(this.activeRoomId);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    if (this.typingSubscription) {
      this.typingSubscription.unsubscribe();
    }
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }
  }

  private initializeRealTimeSubscriptions() {
    // Subscribe to real-time messages
    this.messageSubscription = this.chatService.messages$.subscribe(
      (messages) => {
        this.messages.set(messages);
        this.updateGroupedMessages();
        this.scrollToBottom();
      }
    );

    // Subscribe to typing indicators
    this.typingSubscription = this.chatService.typingUsers$.subscribe(
      (typingUsers) => {
        this.typingUsers.set(typingUsers);
      }
    );

    // Subscribe to socket connection status
    this.connectionSubscription =
      this.socketService.connectionStatus$.subscribe((isConnected) => {
        this.isSocketConnected.set(isConnected);
        // console.log('Socket connection status:', isConnected);
      });
  }

  private setupRouteParams() {
    this.route.queryParams.subscribe((params) => {
      if (params['userId']) {
        this.loadUserChat(params['userId']);
      } else if (params['groupId']) {
        this.loadGroupChat(params['groupId']);
      }
    });
  }

  private setupSocketListeners() {
    // Note: Message handling is done through chatService.messages$ subscription
    // No need for direct socket message subscription to avoid duplicates

    // Listen for typing indicators
    const typingSub = this.socketService.typing$.subscribe(
      (typingData: any) => {
        if (
          typingData &&
          this.selectedUser() &&
          typingData.userId === this.selectedUser()!._id
        ) {
          this.isTyping.set(typingData.isTyping);
          if (typingData.isTyping) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(
              () => this.isTyping.set(false),
              3000
            );
          }
        }
      }
    );

    // Listen for user status changes (if method exists)
    // const statusSub = this.socketService.onUserStatusChange().subscribe((data: any) => {
    //   if (this.selectedUser() && data.userId === this.selectedUser()!._id) {
    //     this.selectedUser.set({ ...this.selectedUser()!, status: data.status });
    //   }
    // });

    this.subscriptions.push(typingSub);
  }

  private async loadUserChat(userId: string) {
    this.isLoading.set(true);
    try {
      // Only clear messages if switching to a different chat
      const currentUserId = this.selectedUser()?._id;
      if (currentUserId !== userId) {
        this.chatService.clearMessages();
      }

      if (this.activeRoomId) {
        this.chatService.leaveChat(this.activeRoomId);
      }

      // Load user details
      const users = await this.chatService.getUsers().toPromise();
      const user = users?.find((u) => u._id === userId);
      if (!user) {
        this.router.navigate(['/chat']);
        return;
      }

      this.selectedUser.set(user);
      this.selectedGroup.set(null);
      this.activeRoomId = this.generateRoomId(this.currentUser()!._id, userId);

      // Join chat room for real-time communication
      this.chatService.joinChat(this.activeRoomId, 'private');

      // Load messages
      const messages = await this.chatService
        .getPrivateMessages(userId)
        .toPromise();
      this.messages.set(messages || []);
      this.updateGroupedMessages();
    } catch (error) {
      console.error('Error loading user chat:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadGroupChat(groupId: string) {
    this.isLoading.set(true);
    try {
      // Only clear messages if switching to a different chat
      const currentGroupId = this.selectedGroup()?._id;
      if (currentGroupId !== groupId) {
        this.chatService.clearMessages();
      }

      if (this.activeRoomId) {
        this.chatService.leaveChat(this.activeRoomId);
      }

      // Load group details
      const group = await this.groupService
        .getGroupDetails(groupId)
        .toPromise();
      if (!group) {
        this.router.navigate(['/chat']);
        return;
      }

      this.selectedGroup.set(group);
      this.selectedUser.set(null);
      this.activeRoomId = `group_${groupId}`;

      // Join chat room for real-time communication
      this.chatService.joinChat(this.activeRoomId, 'group');

      // Load messages
      const messages = await this.chatService
        .getGroupMessages(groupId)
        .toPromise();
      this.messages.set(messages || []);
      this.updateGroupedMessages();
    } catch (error) {
      console.error('Error loading group chat:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Message handling is done through chatService.messages$ subscription

  sendMessage() {
    if (!this.canSendMessage()) return;

    const content = this.messageText().trim();
    const replyTo = this.replyToMessage()?._id;
    this.isSending.set(true);

    try {
      if (this.isGroupChat()) {
        this.chatService.sendGroupMessage(
          this.selectedGroup()!._id,
          content,
          replyTo
        );
      } else {
        this.chatService.sendPrivateMessage(
          this.selectedUser()!._id,
          content,
          replyTo
        );
      }

      this.messageText.set('');
      this.replyToMessage.set(null);
      this.showEmojiPicker.set(false);

      // Stop typing indicator
      this.stopTyping();

      // Message will be added via socket listener
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      this.isSending.set(false);
    }
  }

  handleTyping() {
    if (!this.activeRoomId || !this.currentUser()) return;

    const isTyping = this.messageText().length > 0;

    if (isTyping && !this.isTyping()) {
      this.isTyping.set(true);
      if (this.isGroupChat()) {
        this.chatService.startTyping(undefined, this.selectedGroup()!._id);
      } else {
        this.chatService.startTyping(this.selectedUser()!._id);
      }
    } else if (!isTyping && this.isTyping()) {
      this.isTyping.set(false);
      if (this.isGroupChat()) {
        this.chatService.stopTyping(undefined, this.selectedGroup()!._id);
      } else {
        this.chatService.stopTyping(this.selectedUser()!._id);
      }
    }

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set timeout to stop typing after 3 seconds of inactivity
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 3000);
    }
  }

  private stopTyping() {
    if (this.isTyping()) {
      this.isTyping.set(false);
      if (this.isGroupChat()) {
        this.chatService.stopTyping(undefined, this.selectedGroup()!._id);
      } else {
        this.chatService.stopTyping(this.selectedUser()!._id);
      }
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  private updateGroupedMessages() {
    this.groupMessagesByDate();
  }

  private groupMessagesByDate() {
    const grouped: { [date: string]: Message[] } = {};

    this.messages().forEach((message) => {
      const dateKey = new Date(message.timestamp).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(message);
    });

    this.groupedMessages.set(
      Object.entries(grouped)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, messages]) => ({
          date,
          messages: messages.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
        }))
    );
  }

  private generateRoomId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  private formatLastSeen(lastSeen: Date): string {
    const now = new Date();
    const diffInMinutes =
      (now.getTime() - new Date(lastSeen).getTime()) / (1000 * 60);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }

  // UI Methods
  toggleEmojiPicker() {
    this.showEmojiPicker.set(!this.showEmojiPicker());
    this.showFileUpload.set(false);
    this.showVoiceRecording.set(false);
  }

  toggleFileUpload() {
    this.showFileUpload.set(!this.showFileUpload());
    this.showEmojiPicker.set(false);
    this.showVoiceRecording.set(false);

    // If showing file upload, trigger the file input after a short delay
    if (this.showFileUpload()) {
      setTimeout(() => {
        this.triggerFileInput();
      }, 100);
    }
  }

  toggleVoiceRecording() {
    this.showVoiceRecording.set(!this.showVoiceRecording());
    this.showEmojiPicker.set(false);
    this.showFileUpload.set(false);

    // If showing voice recording, auto-start recording after a short delay
    if (this.showVoiceRecording()) {
      setTimeout(() => {
        if (this.voiceRecorderComponent) {
          this.voiceRecorderComponent.startRecording();
        }
      }, 100);
    }
  }

  addEmoji(emoji: string) {
    this.messageText.update((text) => text + emoji);
    this.showEmojiPicker.set(false);
    if (this.messageInput && this.messageInput.nativeElement) {
      this.messageInput.nativeElement.focus();
    }
  }

  setReplyTo(message: Message) {
    this.replyToMessage.set(message);
    this.showMessageOptions.set(null);
    this.messageInput.nativeElement.focus();
  }

  clearReply() {
    this.replyToMessage.set(null);
  }

  showMessageMenu(messageId: string) {
    this.showMessageOptions.set(
      this.showMessageOptions() === messageId ? null : messageId
    );
  }

  async deleteMessage(messageId: string) {
    try {
      this.chatService.deleteMessage(messageId);
      this.messages.update((msgs) => msgs.filter((m) => m._id !== messageId));
      this.groupMessagesByDate();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    this.showMessageOptions.set(null);
  }

  async editMessage(messageId: string, newContent: string) {
    try {
      this.chatService.editMessage(messageId, newContent);
      this.messages.update((msgs) =>
        msgs.map((m) =>
          m._id === messageId ? { ...m, content: newContent, edited: true } : m
        )
      );
      this.groupMessagesByDate();
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }

  async addReaction(messageId: string, emoji: string) {
    try {
      await this.chatService.addReaction(messageId, emoji).toPromise();
      // Update message with new reaction
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onWindowResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile.set(window.innerWidth <= 768);
  }

  goBack() {
    this.router.navigate(['/chat']);
  }

  // File Upload Methods
  onFileUploaded(result: any) {
    // Create a file message and send it immediately
    const fileMessage = this.createFileMessage(result);

    try {
      if (this.isGroupChat()) {
        this.chatService.sendGroupMessage(
          this.selectedGroup()!._id,
          fileMessage.content,
          undefined,
          result.url,
          result.type
        );
      } else {
        this.chatService.sendPrivateMessage(
          this.selectedUser()!._id,
          fileMessage.content,
          undefined,
          result.url,
          result.type
        );
      }
    } catch (error) {
      // Handle error silently
    }

    this.showFileUpload.set(false);
  }

  private createFileMessage(fileResult: any): {
    content: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'file';
  } {
    const fileType = fileResult.type;
    const fileName = fileResult.name;
    const fileSize = this.formatFileSize(fileResult.size);

    let content = '';
    let type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text';

    switch (fileType) {
      case 'image':
        content = `📷 Image: ${fileName} (${fileSize})`;
        type = 'image';
        break;
      case 'video':
        content = `🎥 Video: ${fileName} (${fileSize})`;
        type = 'video';
        break;
      case 'audio':
        content = `🎵 Audio: ${fileName} (${fileSize})`;
        type = 'audio';
        break;
      default:
        content = `📄 File: ${fileName} (${fileSize})`;
        type = 'file';
    }

    return { content, type };
  }

  onFileUploadError(error: string) {
    // Handle file upload error silently
  }

  onVoiceRecordingComplete(result: VoiceRecordingResult) {
    // Create a file from the audio blob
    const audioFile = new File([result.audioBlob], `voice-${Date.now()}.webm`, {
      type: 'audio/webm',
    });

    // Send voice message through file upload service
    try {
      if (this.isGroupChat()) {
        this.chatService
          .uploadFile(
            audioFile,
            undefined, // receiverId
            this.selectedGroup()!._id, // groupId
            `Voice message (${this.formatDuration(result.duration)})`
          )
          .subscribe({
            next: (uploadResult) => {
              // Voice message uploaded successfully
            },
            error: (error) => {
              // Handle error silently
            },
          });
      } else {
        this.chatService
          .uploadFile(
            audioFile,
            this.selectedUser()!._id, // receiverId
            undefined, // groupId
            `Voice message (${this.formatDuration(result.duration)})`
          )
          .subscribe({
            next: (uploadResult) => {
              // Voice message uploaded successfully
            },
            error: (error) => {
              // Handle error silently
            },
          });
      }
    } catch (error) {
      // Handle error silently
    }
  }

  onVoiceRecordingError(error: string) {
    // Handle voice recording error silently
  }

  onVoiceRecordingCancelled() {
    // Voice recording cancelled
  }

  // Voice Recording Methods
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.sendVoiceMessage(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.startRecordingTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.stopRecordingTimer();
    }
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.stopRecordingTimer();
      this.audioChunks = [];
    }
  }

  private startRecordingTimer() {
    let seconds = 0;
    this.recordingInterval = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      this.recordingTime.set(
        `${minutes.toString().padStart(2, '0')}:${remainingSeconds
          .toString()
          .padStart(2, '0')}`
      );
    }, 1000);
  }

  private stopRecordingTimer() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
      this.recordingTime.set('00:00');
    }
  }

  private sendVoiceMessage(audioBlob: Blob) {
    const audioUrl = URL.createObjectURL(audioBlob);

    // Add the voice message to the current message text
    this.messageText.update(
      (text) => text + `[Voice Message: ${Math.round(audioBlob.size / 1024)}KB]`
    );
    this.showVoiceRecording.set(false);
  }

  // Video Call Methods
  startVideoCall() {
    const roomId = `room_${Date.now()}`;
    const participants = this.isGroupChat()
      ? this.selectedGroup()?.members?.map((m) => m._id) || []
      : [this.selectedUser()?._id || ''];

    this.videoCallRoomId.set(roomId);
    this.videoCallParticipants.set(participants);
    this.showVideoCall.set(true);
  }

  endVideoCall() {
    this.showVideoCall.set(false);
    this.videoCallRoomId.set('');
    this.videoCallParticipants.set([]);
  }

  // Additional UI Methods
  searchMessages() {
    // Show search overlay
    this.showMessageSearch.set(true);
  }

  showMoreOptions() {
    // Toggle more options menu
    this.showMessageOptions.set(
      this.showMessageOptions() ? null : 'chat-options'
    );
  }

  // Message Search Methods
  performMessageSearch() {
    const query = this.searchQuery().toLowerCase();
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }

    const results = this.messages().filter((message) =>
      message.content.toLowerCase().includes(query)
    );
    this.searchResults.set(results);
  }

  closeMessageSearch() {
    this.showMessageSearch.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  jumpToMessage(message: Message) {
    // Find the message in the current messages and scroll to it
    const messageElement = document.querySelector(
      `[data-message-id="${message._id}"]`
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message temporarily
      messageElement.classList.add('search-highlight');
      setTimeout(() => {
        messageElement.classList.remove('search-highlight');
      }, 3000);
    }
    this.closeMessageSearch();
  }

  // More Options Methods
  clearChat() {
    if (
      confirm(
        'Are you sure you want to clear this chat? This action cannot be undone.'
      )
    ) {
      // Implement clear chat functionality
      // console.log('Clear chat'); // Commented for production
      this.showMessageOptions.set(null);
    }
  }

  blockUser() {
    if (confirm('Are you sure you want to block this user?')) {
      // Implement block user functionality
      // console.log('Block user'); // Commented for production
      this.showMessageOptions.set(null);
    }
  }

  toggleGroupInfo() {
    this.showGroupInfo.set(!this.showGroupInfo());
    this.showMessageOptions.set(null);
  }

  // Helper method to trigger file input
  private triggerFileInput() {
    if (this.fileUploadComponent) {
      this.fileUploadComponent.triggerFileInput();
    }
  }

  // Media handling methods
  openImagePreview(imageUrl: string) {
    this.previewImageUrl.set(imageUrl);
    this.showImagePreview.set(true);
  }

  closeImagePreview() {
    this.showImagePreview.set(false);
    this.previewImageUrl.set('');
  }

  openVideoPreview(videoUrl: string) {
    this.previewVideoUrl.set(videoUrl);
    this.showVideoPreview.set(true);
  }

  closeVideoPreview() {
    this.showVideoPreview.set(false);
    this.previewVideoUrl.set('');
  }

  toggleAudioPlayback(audioUrl: string) {
    if (!this.audioElements.has(audioUrl)) {
      const audio = new Audio(audioUrl);
      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        this.audioProgress.set(audioUrl, progress);
      });
      audio.addEventListener('ended', () => {
        this.audioProgress.set(audioUrl, 0);
      });
      this.audioElements.set(audioUrl, audio);
    }

    const audio = this.audioElements.get(audioUrl)!;
    if (audio.paused) {
      // Pause all other audio elements
      this.audioElements.forEach((a, url) => {
        if (url !== audioUrl && !a.paused) {
          a.pause();
        }
      });
      audio.play();
    } else {
      audio.pause();
    }
  }

  isAudioPlaying(audioUrl: string): boolean {
    const audio = this.audioElements.get(audioUrl);
    return audio ? !audio.paused : false;
  }

  getAudioProgress(audioUrl: string): number {
    return this.audioProgress.get(audioUrl) || 0;
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'pi-image';
    if (mimeType.startsWith('video/')) return 'pi-video';
    if (mimeType.startsWith('audio/')) return 'pi-volume-up';
    if (mimeType.includes('pdf')) return 'pi-file-pdf';
    if (mimeType.includes('word')) return 'pi-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
      return 'pi-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
      return 'pi-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('rar'))
      return 'pi-file-archive';
    return 'pi-file';
  }

  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  downloadFile(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
