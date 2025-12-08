import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../../../core/services/chat/chat.service';
import { GroupService } from '../../../../../core/services/group/group.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import {
  SocketService,
  OnlineUser,
} from '../../../../../core/services/socket/socket.service';
import { User, Group } from '../../../../../core/interfaces/group.model';
import { Message } from '../../../../../core/interfaces/message.model';
import { Default_Img_Url } from '../../../../../../utils/constants.utils';

export interface ChatItem {
  id: string;
  type: 'user' | 'group';
  name: string;
  avatar: string;
  lastMessage?: string;
  timestamp?: Date;
  unreadCount: number;
  isOnline?: boolean;
  status?: string;
  data: User | Group;
}

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.scss',
})
export class ChatSidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private chatService = inject(ChatService);
  private groupService = inject(GroupService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);

  public searchText = signal('');
  public selectedTab = signal<'chats' | 'groups'>('chats');
  public users = signal<User[]>([]);
  public groups = signal<Group[]>([]);
  public chatItems = signal<ChatItem[]>([]);
  public currentUser = this.authService.currentUser;
  public defaultAvatar = Default_Img_Url;
  public isLoading = signal(false);
  public showNewChatModal = signal(false);
  public newChatSearch = signal('');

  // Added allUsers signal
  public allUsers = signal<User[]>([]);

  private subscriptions: Subscription[] = [];

  @Output() chatSelected = new EventEmitter<void>();

  public filteredChatItems = computed(() => {
    const search = this.searchText().toLowerCase();
    if (!search) return this.chatItems();

    return this.chatItems().filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.lastMessage?.toLowerCase().includes(search)
    );
  });

  public recentChats = computed(() =>
    this.filteredChatItems().filter((item) => item.type === 'user')
  );

  public groupChats = computed(() =>
    this.filteredChatItems().filter((item) => item.type === 'group')
  );

  public filteredUsersForNewChat = computed(() => {
    const query = this.newChatSearch().toLowerCase();
    const list = this.allUsers();
    if (!query) return list;
    return list.filter((user) =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(query)
    );
  });

  public getCurrentTabItems() {
    return this.selectedTab() === 'chats'
      ? this.recentChats()
      : this.groupChats();
  }

  ngOnInit() {
    this.loadData();
    this.setupSocketListeners();
    this.subscribeToNewChatRequests();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadData() {
    this.isLoading.set(true);

    // Load conversations (users with last message and unread count)
    const conversationsSub = this.chatService.getConversations().subscribe({
      next: (conversations) => {
        // Map conversations to users with additional metadata
        const users = conversations.map((conv) => ({
          _id: conv._id,
          firstName: conv.userDetails.firstName,
          lastName: conv.userDetails.lastName,
          username: conv.userDetails.username,
          email: conv.userDetails.email || '',
          photoUrl: conv.userDetails.photoUrl,
          status: conv.userDetails.status,
          lastSeen: conv.userDetails.lastSeen,
          unreadCount: conv.unreadCount,
          lastMessage: conv.lastMessage?.content || '',
          lastMessageTime: conv.lastMessage?.timestamp,
        }));
        this.users.set(users);
        this.updateChatItems();
      },
      error: (error) => {
        // Fallback to getUsers if conversations endpoint fails
        this.chatService.getUsers().subscribe({
          next: (users) => {
            this.users.set(
              users.filter((u) => u._id !== this.currentUser()?._id)
            );
            this.updateChatItems();
          },
        });
      },
    });

    const groupsSub = this.groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.updateChatItems();
      },
      error: (error) => {
        // Error handled silently - groups will see empty list
      },
    });

    // Load all users for the "New Chat" modal
    const allUsersSub = this.chatService.getUsers().subscribe({
      next: (users) => {
        this.allUsers.set(
          users.filter((u) => u._id !== this.currentUser()?._id)
        );
      },
      error: (error) => {
        console.error('Failed to load users for new chat', error);
      },
    });

    this.subscriptions.push(conversationsSub, groupsSub, allUsersSub);
  }

  private updateChatItems() {
    const items: ChatItem[] = [];

    // Add user chats
    this.users().forEach((user: any) => {
      items.push({
        id: user._id,
        type: 'user',
        name: `${user.firstName} ${user.lastName}`,
        avatar: user.photoUrl || this.defaultAvatar,
        lastMessage: user.lastMessage || undefined,
        timestamp: user.lastMessageTime
          ? new Date(user.lastMessageTime)
          : undefined,
        unreadCount: user.unreadCount || 0,
        isOnline: user.status === 'online',
        status: user.statusMessage,
        data: user,
      });
    });

    // Add group chats
    this.groups().forEach((group) => {
      items.push({
        id: group._id,
        type: 'group',
        name: group.name,
        avatar: group.avatar || this.defaultAvatar,
        unreadCount: group.unreadCount || 0,
        data: group,
      });
    });

    // Sort by last activity
    items.sort((a, b) => {
      const aTime = a.timestamp?.getTime() || 0;
      const bTime = b.timestamp?.getTime() || 0;
      return bTime - aTime;
    });

    this.chatItems.set(items);
    this.isLoading.set(false);
  }

  private setupSocketListeners() {
    // Listen for new messages
    const messageSub = this.socketService.message$.subscribe(
      (message: Message | null) => {
        if (message) {
          this.updateLastMessage(message);
        }
      }
    );

    // Listen for online users
    const onlineUsersSub = this.socketService.onlineUsers$.subscribe(
      (onlineUsers: OnlineUser[]) => {
        this.handleOnlineStatusUpdate(onlineUsers);
      }
    );

    this.subscriptions.push(messageSub, onlineUsersSub);
  }

  private handleOnlineStatusUpdate(onlineUsers: OnlineUser[]) {
    const onlineUserIds = new Set(onlineUsers.map((u) => u.userId));

    // Update conversations list users
    const currentUsers = this.users();
    const updatedUsers = currentUsers.map((user) => ({
      ...user,
      status: (onlineUserIds.has(user._id) ? 'online' : 'offline') as
        | 'online'
        | 'offline',
    }));
    this.users.set(updatedUsers);

    // Update all users list (for "New Chat" modal)
    const currentAllUsers = this.allUsers();
    const updatedAllUsers = currentAllUsers.map((user) => ({
      ...user,
      status: (onlineUserIds.has(user._id) ? 'online' : 'offline') as
        | 'online'
        | 'offline',
    }));
    this.allUsers.set(updatedAllUsers);

    // Update the sidebar items
    this.updateChatItems();
  }

  private subscribeToNewChatRequests() {
    const newChatSub = this.chatService.newChatRequested$.subscribe(() => {
      this.openNewChatModal();
    });
    this.subscriptions.push(newChatSub);
  }

  private updateLastMessage(message: Message) {
    // Add null checks to prevent errors - but be more lenient
    if (!message || !message._id) {
      return;
    }

    // Check if sender exists, but don't block if it's just missing _id
    const senderId = message.sender?._id || (message.sender as any)?._id;
    if (!senderId && !message.group?._id) {
      // If no sender and no group, skip but don't error
      return;
    }

    const items = this.chatItems();
    const itemIndex = items.findIndex((item) => {
      if (item.type === 'user') {
        return item.id === senderId || item.id === message.receiver?._id;
      } else {
        return item.id === message.group?._id;
      }
    });

    if (itemIndex !== -1) {
      // Update last message content - handle different message types
      const messageContent =
        message.content ||
        (message.attachments && message.attachments.length > 0
          ? `📎 ${message.attachments[0].type || 'file'}`
          : 'Message');
      items[itemIndex].lastMessage = messageContent;
      items[itemIndex].timestamp = new Date(message.timestamp || Date.now());
      if (senderId && senderId !== this.currentUser()?._id) {
        items[itemIndex].unreadCount++;
      }
      this.chatItems.set([...items]);
    }
  }

  selectChatItem(item: ChatItem) {
    this.chatSelected.emit();

    if (item.type === 'user') {
      this.router.navigate(['/chat'], {
        queryParams: { userId: item.id },
      });
    } else {
      this.router.navigate(['/chat'], {
        queryParams: { groupId: item.id },
      });
    }
  }

  selectTab(tab: 'chats' | 'groups') {
    this.selectedTab.set(tab);
  }

  createNewChat() {
    this.openNewChatModal();
  }

  createNewGroup() {
    this.router.navigate(['/create-group']);
  }

  formatLastMessage(message: string): string {
    if (!message) return '';
    return message.length > 50 ? message.substring(0, 50) + '...' : message;
  }

  formatTimestamp(timestamp: Date): string {
    if (!timestamp) return '';

    const now = new Date();
    const diffInHours =
      (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else if (diffInHours < 168) {
      // 7 days
      return `${Math.floor(diffInHours / 24)}d`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  private openNewChatModal() {
    this.showNewChatModal.set(true);
    this.newChatSearch.set('');
  }

  closeNewChatModal() {
    this.showNewChatModal.set(false);
    this.newChatSearch.set('');
  }

  startChatWithUser(user: User) {
    this.closeNewChatModal();
    this.router.navigate(['/chat'], {
      queryParams: { userId: user._id },
    });
  }
}
