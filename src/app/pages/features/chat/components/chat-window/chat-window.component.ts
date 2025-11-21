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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../../../core/services/chat/chat.service';
import { GroupService } from '../../../../../core/services/group/group.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { SocketService } from '../../../../../core/services/socket/socket.service';
import { AlertService } from '../../../../../core/services/alerts/alert.service';
import { LoggerService } from '../../../../../core/services/logging/logger.service';
import { VideoCallService } from '../../../../../core/services/video-call/video-call.service';
import { User, Group } from '../../../../../core/interfaces/group.model';
import { Message } from '../../../../../core/interfaces/message.model';
import { FileUploadComponent, FileUploadResult } from '../../../../../shared/components/file-upload/file-upload.component';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { VideoCallComponent } from '../../../../../shared/components/video-call/video-call.component';
import {
  VoiceRecorderComponent,
  VoiceRecordingResult,
} from '../../../../../shared/components/voice-recorder/voice-recorder.component';
import { Default_Img_Url } from '../../../../../../utils/constants.utils';
import { formatFileSize, getFileType, createFileMessageContent } from '../../../../../../utils/file.utils';
import { formatDuration, formatMessageTime, groupMessagesByDate } from '../../../../../../utils/message.utils';

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

  // Voice recording
  public isRecording = signal(false);

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
  public isMuted = signal(false);

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
      this.logger.error('Error loading user chat', error);
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
      this.logger.error('Error loading group chat', error);
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
      this.logger.error('Error sending message', error);
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
    // Use utility function for message grouping
    this.groupedMessages.set(groupMessagesByDate(this.messages()));
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

  private formatLastSeen(lastSeen: Date | string): string {
    return formatMessageTime(lastSeen);
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
      this.logger.error('Error deleting message', error);
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
      this.logger.error('Error editing message', error);
    }
  }

  async addReaction(messageId: string, emoji: string) {
    try {
      await this.chatService.addReaction(messageId, emoji).toPromise();
      // Update message with new reaction
    } catch (error) {
      this.logger.error('Error adding reaction', error);
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

  // File Upload Methods
  onFileUploaded(result: FileUploadResult) {
    // File upload is handled by backend via socket
    // The message is automatically created and broadcasted
    // Just show success and close the panel
    this.alertService.successToaster('File sent successfully');
    this.showFileUpload.set(false);
  }

  onFileUploadError(error: string) {
    this.alertService.errorToaster(error || 'Failed to upload file');
    this.showFileUpload.set(false);
  }

  onVoiceRecordingComplete(result: VoiceRecordingResult) {
    // Create a file from the audio blob
    const audioFile = new File([result.audioBlob], `voice-${Date.now()}.webm`, {
      type: result.audioBlob.type || 'audio/webm',
    });

    // Send voice message through file upload service
    try {
      if (this.isGroupChat() && this.selectedGroup()) {
        this.chatService
          .uploadFile(
            audioFile,
            undefined, // receiverId
            this.selectedGroup()!._id // groupId
          )
          .subscribe({
            next: (uploadResult) => {
              if (uploadResult.type === 'complete') {
                // Voice message uploaded successfully
                this.showVoiceRecording.set(false);
                this.alertService.successToaster('Voice message sent successfully');
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
            undefined // groupId
          )
          .subscribe({
            next: (uploadResult) => {
              if (uploadResult.type === 'complete') {
                // Voice message uploaded successfully
                this.showVoiceRecording.set(false);
                this.alertService.successToaster('Voice message sent successfully');
              }
            },
            error: (error) => {
              this.logger.error('Voice message upload error', error);
              this.alertService.errorToaster('Failed to send voice message');
              this.showVoiceRecording.set(false);
            },
          });
      } else {
        this.alertService.errorToaster('Please select a chat to send voice message');
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
      this.alertService.errorToaster('Please select a chat to start video call');
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
      this.chatService.clearMessages();
      this.messages.set([]);
      this.groupedMessages.set([]);
      this.showMessageOptions.set(null);
      this.alertService.successToaster('Chat cleared successfully');
    }
  }

  blockUser() {
    if (confirm('Are you sure you want to block this user?')) {
      const userId = this.selectedUser()?._id;
      if (userId) {
        // TODO: Implement block user API call
        this.alertService.infoToaster('Block user functionality coming soon');
        this.showMessageOptions.set(null);
      }
    }
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
    // Close more options menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.more-options-menu') && !target.closest('.action-btn')) {
      if (this.showMessageOptions() === 'chat-options') {
        this.closeMoreOptions();
      }
    }
  }

  viewProfile() {
    if (this.selectedUser()) {
      // Navigate to user profile or show profile modal
      this.alertService.infoToaster('View profile feature coming soon');
      this.closeMoreOptions();
    }
  }

  viewGroupMembers() {
    if (this.selectedGroup()) {
      // Show group members modal
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
      if (confirm(`Are you sure you want to leave "${groupName}"?`)) {
        this.groupService.leaveGroup(this.selectedGroup()!._id, currentUser._id).subscribe({
          next: () => {
            this.alertService.successToaster('Left group successfully');
            this.router.navigate(['/chat']);
            this.closeMoreOptions();
          },
          error: (error) => {
            this.alertService.errorToaster('Failed to leave group');
            this.logger.error('Error leaving group', error);
          }
        });
      }
    }
  }

  muteNotifications() {
    this.isMuted.update(current => !current);
    const status = this.isMuted() ? 'muted' : 'unmuted';
    this.alertService.successToaster(`Notifications ${status}`);
  }

  exportChat() {
    // Export chat messages as file
    const messages = this.messages();
    if (messages.length === 0) {
      this.alertService.warningToaster('No messages to export');
      return;
    }

    const chatData = messages.map(msg => ({
      sender: `${msg.sender.firstName} ${msg.sender.lastName}`,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toLocaleString(),
      type: msg.type
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
    
    if (confirm(`Are you sure you want to delete chat with "${chatName}"? This action cannot be undone.`)) {
      // Delete chat history
      this.messages.set([]);
      this.groupedMessages.set([]);
      this.alertService.successToaster('Chat deleted successfully');
      this.router.navigate(['/chat']);
      this.closeMoreOptions();
    }
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
    // If it's a local URL, try to construct the full URL
    if (event.target.src.startsWith('/uploads/')) {
      const fullUrl = `${window.location.origin}${event.target.src}`;
      event.target.src = fullUrl;
    } else {
      // Hide the image if it still fails
      event.target.style.display = 'none';
    }
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
    return getFileType(mimeType) === 'image' ? 'pi-image' :
           getFileType(mimeType) === 'video' ? 'pi-video' :
           getFileType(mimeType) === 'audio' ? 'pi-volume-up' :
           mimeType.includes('pdf') ? 'pi-file-pdf' :
           mimeType.includes('word') ? 'pi-file-word' :
           mimeType.includes('excel') || mimeType.includes('spreadsheet') ? 'pi-file-excel' :
           mimeType.includes('powerpoint') || mimeType.includes('presentation') ? 'pi-file-powerpoint' :
           mimeType.includes('zip') || mimeType.includes('rar') ? 'pi-file-archive' :
           'pi-file';
  }

  // Use utility functions
  public formatFileSize = formatFileSize;
  public formatDuration = formatDuration;

  downloadFile(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
