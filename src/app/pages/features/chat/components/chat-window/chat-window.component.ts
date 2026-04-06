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
  HostListener,
  ChangeDetectorRef,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { ChatService } from '../../../../../core/services/chat/chat.service';
import { GroupService } from '../../../../../core/services/group/group.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { SocketService } from '../../../../../core/services/socket/socket.service';
import { AlertService } from '../../../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../../../core/services/logging/logger.service';
import { VideoCallService } from '../../../../../core/services/video-call/video-call.service';
import { ThemeService } from '../../../../../core/services/theme/theme.service';
import { User, Group } from '../../../../../core/interfaces/group.model';
import { Message } from '../../../../../core/interfaces/message.model';
import {
  FileUploadComponent,
  FileUploadResult,
} from '../../../../../shared/components/file-upload/file-upload.component';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { VideoCallComponent } from '../../../../../shared/components/video-call/video-call.component';
import {
  VoiceRecorderComponent,
  VoiceRecordingResult,
} from '../../../../../shared/components/voice-recorder/voice-recorder.component';
import { Default_Img_Url } from '../../../../../../utils/constants.utils';
import {
  formatFileSize,
  getFileType,
} from '../../../../../../utils/file.utils';
import {
  formatDuration,
  formatMessageTime,
  groupMessagesByDate,
} from '../../../../../../utils/message.utils';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PickerComponent,
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
  private alertService = inject(AlertService);
  private logger = inject(LoggerService);
  private videoCallService = inject(VideoCallService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);

  public emojiTheme = computed(() => {
    const baseTheme = this.themeService.getBaseThemeType();
    return baseTheme === 'dark-mode' ? 'dark' : 'light';
  });

  public isDarkMode = computed(() => {
    return this.themeService.getBaseThemeType() === 'dark-mode';
  });

  public accentColor = computed(() => {
    return this.themeService.currentTheme().colors.accent;
  });

  private messageSubscription?: Subscription;
  private typingSubscription?: Subscription;
  private connectionSubscription?: Subscription;

  public currentUser = this.authService.currentUser;
  public defaultAvatar = Default_Img_Url;

  public showBackButton = input(false);
  public backClicked = output<void>();

  public messages = signal<Message[]>([]);
  public typingUsers = signal<any[]>([]);
  public isTyping = signal(false);
  public isSocketConnected = signal(false);

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

  public showImagePreview = signal(false);
  public showVideoPreview = signal(false);
  public previewImageUrl = signal<string>('');
  public previewVideoUrl = signal<string>('');

  private audioElements = new Map<string, HTMLAudioElement>();
  private audioProgress = new Map<string, number>();
  private audioCurrentTime = new Map<string, number>();

  public isRecording = signal(false);

  public showVideoCall = signal(false);
  public videoCallRoomId = signal('');
  public videoCallParticipants = signal<string[]>([]);

  public showMessageSearch = signal(false);
  public searchQuery = signal('');
  public searchResults = signal<Message[]>([]);

  public isMobile = signal(false);
  public showGroupInfo = signal(false);
  public showUserProfile = signal(false);
  public showMessageOptions = signal<string | null>(null);
  public isMuted = signal<boolean>(false);
  public aiReplies = signal<string[]>([]);
  public isAiLoading = signal<boolean>(false);

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
    () => this.messageText().trim().length > 0 && !this.isSending(),
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
      this.socketService.leaveRoom(
        this.activeRoomId,
        this.isGroupChat() ? 'group' : 'private',
      );
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
    this.messageSubscription = this.chatService.messages$.subscribe(
      (messages) => {
        const prevCount = this.messages().length;
        this.messages.set(messages);
        this.updateGroupedMessages();
        this.scrollToBottom();

        if (messages.length > prevCount) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.sender?._id !== this.currentUser()?._id) {
            this.fetchAiReplies();
          }
        }
      },
    );

    this.typingSubscription = this.chatService.typingUsers$.subscribe(
      (typingUsers) => {
        this.typingUsers.set(typingUsers);
      },
    );

    this.connectionSubscription =
      this.socketService.connectionStatus$.subscribe((isConnected) => {
        this.isSocketConnected.set(isConnected);
      });

    const onlineUsersSub = this.socketService.onlineUsers$.subscribe(
      (onlineUsers) => {
        const selected = this.selectedUser();
        if (selected) {
          const isOnline = onlineUsers.some((u) => u.userId === selected._id);
          const newStatus = isOnline ? 'online' : 'offline';
          if (selected.status !== newStatus) {
            this.selectedUser.set({
              ...selected,
              status: newStatus,
            });
            this.cdr.markForCheck();
          }
        }
      },
    );
    this.subscriptions.push(onlineUsersSub);
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
              3000,
            );
          }
        }
      },
    );

    this.subscriptions.push(typingSub);
  }

  private async loadUserChat(userId: string) {
    if (this.selectedUser()?._id === userId && this.messages().length > 0) {
      return;
    }

    this.isLoading.set(true);
    try {
      const users = await firstValueFrom(this.chatService.getUsers());
      const user = users?.find((u) => u._id === userId);

      if (!user) {
        this.logger.error('User not found');
        return;
      }

      this.selectedUser.set(user);
      this.selectedGroup.set(null);
      this.messageText.set('');

      if (this.activeRoomId) {
        this.chatService.leaveChat(
          this.activeRoomId,
          this.isGroupChat() ? 'group' : 'private',
        );
      }

      this.activeRoomId = userId;
      this.chatService.joinChat(userId, 'private');

      this.chatService.clearMessages();

      // Load messages
      const messages = await firstValueFrom(
        this.chatService.getPrivateMessages(userId),
      );
      this.messages.set(messages || []);
      this.chatService.setMessages(messages || []);
      this.updateGroupedMessages();
      this.fetchAiReplies();
    } catch (error) {
      this.logger.error('Error loading user chat', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadGroupChat(groupId: string) {
    if (this.selectedGroup()?._id === groupId && this.messages().length > 0) {
      return;
    }

    this.isLoading.set(true);
    try {
      const groups = await firstValueFrom(this.groupService.getMyGroups());
      const group = groups?.find((g: any) => g._id === groupId);

      if (!group) {
        this.logger.error('Group not found');
        return;
      }

      this.selectedGroup.set(group);
      this.selectedUser.set(null);
      this.messageText.set('');

      if (this.activeRoomId) {
        this.chatService.leaveChat(
          this.activeRoomId,
          this.selectedGroup() ? 'group' : 'private',
        );
      }
      this.activeRoomId = groupId;
      this.chatService.joinChat(groupId, 'group');

      this.chatService.clearMessages();

      // Load messages
      const messages = await firstValueFrom(
        this.chatService.getGroupMessages(groupId),
      );
      this.messages.set(messages || []);
      this.chatService.setMessages(messages || []);
      this.updateGroupedMessages();
      this.fetchAiReplies();
    } catch (error) {
      this.logger.error('Error loading group chat', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  public editingMessage = signal<Message | null>(null);

  startEditing(message: Message) {
    this.editingMessage.set(message);
    this.messageText.set(message.content);
    this.showMessageOptions.set(null);
    this.showEmojiPicker.set(false);
    this.showFileUpload.set(false);
    this.showVoiceRecording.set(false);

    setTimeout(() => {
      if (this.messageInput && this.messageInput.nativeElement) {
        this.messageInput.nativeElement.focus();
        this.adjustTextareaHeight();
      }
    });
  }

  cancelEditing() {
    this.editingMessage.set(null);
    this.messageText.set('');
    this.adjustTextareaHeight();
  }

  sendMessage() {
    if (!this.canSendMessage()) return;

    const content = this.messageText().trim();

    if (this.editingMessage()) {
      const messageId = this.editingMessage()!._id;
      try {
        this.chatService.editMessage(messageId, content);
        this.messages.update((msgs) =>
          msgs.map((m) =>
            m._id === messageId ? { ...m, content: content, edited: true } : m,
          ),
        );
        this.updateGroupedMessages();
        this.cancelEditing();
      } catch (error) {
        this.logger.error('Error editing message', error);
      }
      return;
    }

    const replyTo = this.replyToMessage()?._id;
    this.isSending.set(true);

    try {
      if (this.isGroupChat()) {
        this.chatService.sendGroupMessage(
          this.selectedGroup()!._id,
          content,
          replyTo,
        );
      } else {
        this.chatService.sendPrivateMessage(
          this.selectedUser()!._id,
          content,
          replyTo,
        );
      }

      this.messageText.set('');
      this.replyToMessage.set(null);
      this.showEmojiPicker.set(false);
      this.stopTyping();
      this.adjustTextareaHeight();
    } catch (error) {
      this.logger.error('Error sending message', error);
    } finally {
      this.isSending.set(false);
    }
  }

  handleTyping() {
    this.adjustTextareaHeight();
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
    this.groupedMessages.set(groupMessagesByDate(this.messages()));
  }

  private generateRoomId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  private formatLastSeen(lastSeen: Date | string): string {
    return formatMessageTime(lastSeen);
  }

  toggleEmojiPicker() {
    this.showEmojiPicker.set(!this.showEmojiPicker());
    this.showFileUpload.set(false);
    this.showVoiceRecording.set(false);
  }

  toggleFileUpload() {
    this.showFileUpload.set(!this.showFileUpload());
    this.showEmojiPicker.set(false);
    this.showVoiceRecording.set(false);
  }

  toggleVoiceRecording() {
    this.showVoiceRecording.set(!this.showVoiceRecording());
    this.showEmojiPicker.set(false);
    this.showFileUpload.set(false);

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
      this.adjustTextareaHeight();
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
      this.showMessageOptions() === messageId ? null : messageId,
    );
  }

  async deleteMessage(messageId: string) {
    try {
      this.chatService.deleteMessage(messageId);
      this.messages.update((msgs) => msgs.filter((m) => m._id !== messageId));
      this.groupMessagesByDate();
    } catch (error) {
      this.logger.error('Error deleting message', error);
    }
    this.showMessageOptions.set(null);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    } else {
      // Allow general height adjustment on multiline entry
      setTimeout(() => this.adjustTextareaHeight());
    }
  }

  private adjustTextareaHeight() {
    if (this.messageInput && this.messageInput.nativeElement) {
      const textarea = this.messageInput.nativeElement;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  onWindowResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile.set(window.innerWidth <= 768);
  }

  startNewChat() {
    this.selectedUser.set(null);
    this.selectedGroup.set(null);
    this.chatService.clearMessages();
    this.chatService.requestNewChat();
    this.router.navigate(['/chat']);
  }

  goBack() {
    this.router.navigate(['/chat']);
  }

  onFileUploaded(result: FileUploadResult) {
    this.alertService.successToaster('File sent successfully');
    this.showFileUpload.set(false);
  }

  onFileUploadError(error: string) {
    this.alertService.errorToaster(error || 'Failed to upload file');
    this.showFileUpload.set(false);
  }

  onVoiceRecordingComplete(result: VoiceRecordingResult) {
    const audioFile = new File([result.audioBlob], `voice-${Date.now()}.webm`, {
      type: result.audioBlob.type || 'audio/webm',
    });

    try {
      if (this.isGroupChat() && this.selectedGroup()) {
        this.chatService
          .uploadFile(
            audioFile,
            undefined, // receiverId
            this.selectedGroup()!._id, // groupId
          )
          .subscribe({
            next: (uploadResult) => {
              if (uploadResult.type === 'complete') {
                this.showVoiceRecording.set(false);
                this.alertService.successToaster(
                  'Voice message sent successfully',
                );
              }
            },
            error: (error) => {
              this.logger.error('Voice message upload error', error);
              this.alertService.errorToaster('Failed to send voice message');
              this.showVoiceRecording.set(false);
            },
          });
      } else if (this.selectedUser()) {
        this.chatService
          .uploadFile(
            audioFile,
            this.selectedUser()!._id, // receiverId
            undefined, // groupId
          )
          .subscribe({
            next: (uploadResult) => {
              if (uploadResult.type === 'complete') {
                this.showVoiceRecording.set(false);
                this.alertService.successToaster(
                  'Voice message sent successfully',
                );
              }
            },
            error: (error) => {
              this.logger.error('Voice message upload error', error);
              this.alertService.errorToaster('Failed to send voice message');
              this.showVoiceRecording.set(false);
            },
          });
      } else {
        this.alertService.errorToaster(
          'Please select a chat to send voice message',
        );
        this.showVoiceRecording.set(false);
      }
    } catch (error: any) {
      this.logger.error('Voice message error', error);
      this.alertService.errorToaster('Failed to send voice message');
      this.showVoiceRecording.set(false);
    }
  }

  onVoiceRecordingError(error: string) {
    // Handle voice recording error silently
    this.showVoiceRecording.set(false);
  }

  onVoiceRecordingCancelled() {
    // Voice recording cancelled
  }

  // Video Call Methods
  async startVideoCall() {
    if (!this.selectedUser() && !this.selectedGroup()) {
      this.alertService.errorToaster(
        'Please select a chat to start video call',
      );
      return;
    }

    const currentUser = this.currentUser();
    if (!currentUser) {
      this.alertService.errorToaster('User not authenticated');
      return;
    }

    const roomId = this.isGroupChat()
      ? `group_${this.selectedGroup()!._id}`
      : this.generateRoomId(currentUser._id, this.selectedUser()!._id);

    const participants = this.isGroupChat()
      ? this.selectedGroup()?.members?.map((m) => m._id.toString()) || []
      : [this.selectedUser()!._id.toString()];

    if (this.showVideoCall()) {
      return;
    }

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
    this.showMessageSearch.set(true);
  }

  showMoreOptions() {
    this.showMessageOptions.set(
      this.showMessageOptions() ? null : 'chat-options',
    );
  }

  // AI Smart Replies
  fetchAiReplies() {
    const conversationId = this.isGroupChat()
      ? this.selectedGroup()?._id
      : this.selectedUser()?._id;
    if (!conversationId) return;

    this.isAiLoading.set(true);
    this.chatService
      .getSmartReplies(conversationId, this.isGroupChat() ? 'group' : 'private')
      .subscribe({
        next: (res) => {
          this.aiReplies.set(res.replies);
          this.isAiLoading.set(false);
        },
        error: () => {
          this.isAiLoading.set(false);
          this.aiReplies.set([]);
        },
      });
  }

  useAiReply(reply: string) {
    this.messageText.set(reply);
    this.aiReplies.set([]);
    setTimeout(() => this.sendMessage(), 100);
  }

  // Message Search Methods
  performMessageSearch() {
    const query = this.searchQuery().toLowerCase();
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }

    const results = this.messages().filter((message) =>
      message.content.toLowerCase().includes(query),
    );
    this.searchResults.set(results);
  }

  closeMessageSearch() {
    this.showMessageSearch.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  jumpToMessage(message: Message) {
    const messageElement = document.querySelector(
      `[data-message-id="${message._id}"]`,
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('search-highlight');
      setTimeout(() => {
        messageElement.classList.remove('search-highlight');
      }, 3000);
    }
    this.closeMessageSearch();
  }

  // More Options Methods
  clearChat() {
    Swal.fire({
      title: 'Clear Chat?',
      text: 'Are you sure you want to clear this chat? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6',
      confirmButtonText: 'Yes, clear it',
      background: '#1a2437',
      color: '#fff',
    }).then((result) => {
      if (result.isConfirmed) {
        this.chatService.clearMessages();
        this.messages.set([]);
        this.groupedMessages.set([]);
        this.showMessageOptions.set(null);
        this.alertService.successToaster('Chat cleared successfully');
      }
    });
  }

  blockUser() {
    Swal.fire({
      title: 'Block User?',
      text: 'Are you sure you want to block this user? They wont be able to message you.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6',
      confirmButtonText: 'Yes, block user',
      background: '#1a2437',
      color: '#fff',
    }).then((result) => {
      if (result.isConfirmed) {
        const userId = this.selectedUser()?._id;
        if (userId) {
          // TODO: Implement actual block logic when backend is ready
          this.alertService.infoToaster('Block user functionality coming soon');
          this.showMessageOptions.set(null);
        }
      }
    });
  }

  toggleGroupInfo() {
    this.showGroupInfo.set(!this.showGroupInfo());
    this.showMessageOptions.set(null);
  }

  closeMoreOptions() {
    this.showMessageOptions.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      !target.closest('.more-options-menu') &&
      !target.closest('.action-btn')
    ) {
      if (this.showMessageOptions() === 'chat-options') {
        this.closeMoreOptions();
      }
    }
  }

  viewProfile() {
    if (this.selectedUser()) {
      this.showUserProfile.set(true);
      this.closeMoreOptions();
    }
  }

  viewGroupMembers() {
    if (this.selectedGroup()) {
      this.showGroupInfo.set(true);
      this.closeMoreOptions();
    }
  }

  leaveGroup() {
    if (this.selectedGroup()) {
      const groupName = this.selectedGroup()!.name;
      const currentUser = this.currentUser();
      if (!currentUser?._id) {
        this.alertService.errorToaster('User not found. Please log in again.');
        return;
      }

      Swal.fire({
        title: 'Leave Group?',
        text: `Are you sure you want to leave "${groupName}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3b82f6',
        confirmButtonText: 'Yes, leave',
        background: '#1a2437',
        color: '#fff',
      }).then((result) => {
        if (result.isConfirmed) {
          this.groupService
            .leaveGroup(this.selectedGroup()!._id, currentUser._id)
            .subscribe({
              next: () => {
                this.alertService.successToaster('Left group successfully');
                this.router.navigate(['/chat']);
                this.closeMoreOptions();
              },
              error: (error) => {
                this.alertService.errorToaster('Failed to leave group');
                this.logger.error('Error leaving group', error);
              },
            });
        }
      });
    }
  }

  muteNotifications() {
    this.isMuted.update((current) => !current);
    const status = this.isMuted() ? 'muted' : 'unmuted';
    this.alertService.successToaster(`Notifications ${status}`);
  }

  exportChat() {
    const messages = this.messages();
    if (messages.length === 0) {
      this.alertService.warningToaster('No messages to export');
      return;
    }

    const chatData = messages.map((msg) => ({
      sender: `${msg.sender.firstName} ${msg.sender.lastName}`,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toLocaleString(),
      type: msg.type,
    }));

    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    this.alertService.successToaster('Chat exported successfully');
  }

  deleteChat() {
    const chatName = this.isGroupChat()
      ? this.selectedGroup()?.name
      : `${this.selectedUser()?.firstName} ${this.selectedUser()?.lastName}`;

    Swal.fire({
      title: 'Delete Chat?',
      text: `Are you sure you want to delete chat with "${chatName}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6',
      confirmButtonText: 'Yes, delete it',
      background: '#1a2437',
      color: '#fff',
    }).then((result) => {
      if (result.isConfirmed) {
        const userId = this.selectedUser()?._id;
        const groupId = this.selectedGroup()?._id;

        this.chatService.deleteConversation(userId, groupId).subscribe({
          next: () => {
            this.messages.set([]);
            this.groupedMessages.set([]);
            this.selectedUser.set(null);
            this.selectedGroup.set(null);
            this.chatService.clearMessages();

            this.alertService.successToaster('Chat deleted successfully');
            this.router.navigate(['/chat']);
            this.closeMoreOptions();

            setTimeout(() => {
              window.location.reload();
            }, 100);
          },
          error: (error) => {
            this.logger.error('Error deleting chat:', error);
            this.alertService.errorToaster(
              'Failed to delete chat. Please try again.',
            );
          },
        });
      }
    });
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

  handleImageError(event: any) {
    if (event.target.src.startsWith('/uploads/')) {
      const fullUrl = `${window.location.origin}${event.target.src}`;
      event.target.src = fullUrl;
    } else {
      event.target.style.display = 'none';
    }
  }

  toggleAudioPlayback(audioUrl: string) {
    if (!this.audioElements.has(audioUrl)) {
      const audio = new Audio(audioUrl);
      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        this.audioProgress.set(audioUrl, progress);
        this.audioCurrentTime.set(audioUrl, audio.currentTime);
        if (!(this.cdr as any).destroyed) {
          this.cdr.markForCheck();
        }
      });
      audio.addEventListener('ended', () => {
        this.audioProgress.set(audioUrl, 0);
        this.audioCurrentTime.set(audioUrl, 0);
        if (!(this.cdr as any).destroyed) {
          this.cdr.markForCheck();
        }
      });
      audio.addEventListener('loadedmetadata', () => {
        this.audioCurrentTime.set(audioUrl, 0);
        if (!(this.cdr as any).destroyed) {
          this.cdr.markForCheck();
        }
      });
      this.audioElements.set(audioUrl, audio);
    }

    const audio = this.audioElements.get(audioUrl)!;
    if (audio.paused) {
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

  formatAudioTime(audioUrl: string): string {
    const audio = this.audioElements.get(audioUrl);
    if (!audio) {
      return '0:00';
    }
    const currentTime = audio.currentTime || 0;
    if (isNaN(currentTime) || currentTime < 0) {
      return '0:00';
    }
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getFileIcon(mimeType: string): string {
    return getFileType(mimeType) === 'image'
      ? 'pi-image'
      : getFileType(mimeType) === 'video'
        ? 'pi-video'
        : getFileType(mimeType) === 'audio'
          ? 'pi-volume-up'
          : mimeType.includes('pdf')
            ? 'pi-file-pdf'
            : mimeType.includes('word')
              ? 'pi-file-word'
              : mimeType.includes('excel') || mimeType.includes('spreadsheet')
                ? 'pi-file-excel'
                : mimeType.includes('powerpoint') ||
                    mimeType.includes('presentation')
                  ? 'pi-file-powerpoint'
                  : mimeType.includes('zip') || mimeType.includes('rar')
                    ? 'pi-file-archive'
                    : 'pi-file';
  }

  public formatFileSize = formatFileSize;
  public formatDuration = formatDuration;

  downloadFile(url: string, filename: string) {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      })
      .catch(() => {
        // Fallback: open in new tab if fetch fails (e.g. CORS)
        window.open(url, '_blank');
      });
  }
}
