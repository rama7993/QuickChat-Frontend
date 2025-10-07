import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../../../core/services/chat/chat.service';
import { GroupService } from '../../../../../core/services/group/group.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { SocketService } from '../../../../../core/services/socket/socket.service';
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
  styleUrl: './chat-sidebar.component.scss'
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

  private subscriptions: Subscription[] = [];

  public filteredChatItems = computed(() => {
    const search = this.searchText().toLowerCase();
    if (!search) return this.chatItems();
    
    return this.chatItems().filter(item => 
      item.name.toLowerCase().includes(search) ||
      item.lastMessage?.toLowerCase().includes(search)
    );
  });

  public recentChats = computed(() => 
    this.filteredChatItems().filter(item => item.type === 'user')
  );

  public groupChats = computed(() => 
    this.filteredChatItems().filter(item => item.type === 'group')
  );

  public getCurrentTabItems() {
    return this.selectedTab() === 'chats' ? this.recentChats() : this.groupChats();
  }

  ngOnInit() {
    this.loadData();
    this.setupSocketListeners();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadData() {
    this.isLoading.set(true);
    
    // Load users and groups in parallel
    const usersSub = this.chatService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users.filter(u => u._id !== this.currentUser()?._id));
        this.updateChatItems();
      },
      error: (error) => console.error('Error loading users:', error)
    });

    const groupsSub = this.groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.updateChatItems();
      },
      error: (error) => console.error('Error loading groups:', error)
    });

    this.subscriptions.push(usersSub, groupsSub);
  }

  private updateChatItems() {
    const items: ChatItem[] = [];

    // Add user chats
    this.users().forEach(user => {
      items.push({
        id: user._id,
        type: 'user',
        name: `${user.firstName} ${user.lastName}`,
        avatar: user.photoUrl || this.defaultAvatar,
        unreadCount: user.unreadCount || 0,
        isOnline: user.status === 'online',
        status: user.statusMessage,
        data: user
      });
    });

    // Add group chats
    this.groups().forEach(group => {
      items.push({
        id: group._id,
        type: 'group',
        name: group.name,
        avatar: group.avatar || this.defaultAvatar,
        unreadCount: group.unreadCount || 0,
        data: group
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
    const messageSub = this.socketService.message$.subscribe((message: Message | null) => {
      if (message) {
        this.updateLastMessage(message);
      }
    });

    // Listen for user status changes (if method exists)
    // const statusSub = this.socketService.onUserStatusChange().subscribe((data: any) => {
    //   this.updateUserStatus(data.userId, data.status);
    // });

    this.subscriptions.push(messageSub);
  }

  private updateLastMessage(message: Message) {
    const items = this.chatItems();
    const itemIndex = items.findIndex(item => {
      if (item.type === 'user') {
        return item.id === message.sender._id || item.id === message.receiver?._id;
      } else {
        return item.id === message.group?._id;
      }
    });

    if (itemIndex !== -1) {
      items[itemIndex].lastMessage = message.content;
      items[itemIndex].timestamp = new Date(message.timestamp);
      if (message.sender._id !== this.currentUser()?._id) {
        items[itemIndex].unreadCount++;
      }
      this.chatItems.set([...items]);
    }
  }

  private updateUserStatus(userId: string, status: string) {
    const items = this.chatItems();
    const itemIndex = items.findIndex(item => 
      item.type === 'user' && item.id === userId
    );

    if (itemIndex !== -1) {
      items[itemIndex].isOnline = status === 'online';
      items[itemIndex].status = status;
      this.chatItems.set([...items]);
    }
  }

  selectChatItem(item: ChatItem) {
    if (item.type === 'user') {
      this.router.navigate(['/chat'], { 
        queryParams: { userId: item.id } 
      });
    } else {
      this.router.navigate(['/chat'], { 
        queryParams: { groupId: item.id } 
      });
    }
  }

  selectTab(tab: 'chats' | 'groups') {
    this.selectedTab.set(tab);
  }

  createNewChat() {
    // This could open a modal to select users for a new chat
    // console.log('Create new chat'); // Commented for production
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
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }
}
