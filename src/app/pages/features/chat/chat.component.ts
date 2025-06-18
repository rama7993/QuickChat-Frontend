import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { SocketService } from '../../../core/services/socket/socket.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import { FilterPipe } from '../../../core/pipes/filter/filter.pipe';
import { ChatService } from '../../../core/services/chat/chat.service';
import { Message } from '../../../core/interfaces/message.model';
import { Default_Img_Url } from '../../../../utils/constants.utils';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, CommonModule, FilterPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private chatService = inject(ChatService);

  users: any[] = [];
  messages: Message[] = [];
  groupedMessages: { date: string; messages: Message[] }[] = [];
  selectedUser: any = null;
  isMobile: boolean = false;

  messageText = '';
  searchText = '';
  currentUser = this.authService.currentUser;
  defaultAvatar = Default_Img_Url;
  isTyping = false;

  private socketSubscription!: Subscription;
  private typingTimeout: any;
  private activeRoomId = '';

  ngOnInit() {
    this.loadUsers();
    this.checkScreenSize();

    this.socketSubscription = this.socketService
      .onMessage()
      .subscribe((msg) => {
        const senderId = msg.sender?._id;
        const receiverId = msg.receiver?._id;
        const msgRoomId = this.generateRoomId(senderId, receiverId);

        if (this.activeRoomId === msgRoomId) {
          this.messages.push(msg);
          this.groupMessagesByDate();
        }
      });

    this.socketService.onTyping().subscribe(({ user }) => {
      if (this.selectedUser && user._id === this.selectedUser._id) {
        this.isTyping = true;
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => (this.isTyping = false), 1500);
      }
    });
  }

  ngOnDestroy() {
    this.socketSubscription?.unsubscribe();
    this.socketService.disconnect();
  }

  loadUsers() {
    this.chatService.getUsers().subscribe((resp) => {
      this.users = resp.filter((u) => u._id !== this.currentUser()?._id);
    });
  }

  selectUser(user: any) {
    if (this.activeRoomId) {
      this.socketService.leaveRoom(this.activeRoomId);
    }

    this.selectedUser = user;
    this.messages = [];
    this.groupedMessages = [];

    this.activeRoomId = this.generateRoomId(this.currentUser()._id, user._id);
    this.socketService.joinRoom(this.activeRoomId);

    this.chatService
      .getMessages(this.currentUser()._id, user._id)
      .subscribe((msgs) => {
        this.messages = msgs;
        this.groupMessagesByDate();
      });
  }

  generateRoomId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  sendMessage() {
    if (!this.messageText.trim() || !this.selectedUser) return;

    const newMsg = {
      sender: this.currentUser()._id,
      receiver: this.selectedUser._id,
      content: this.messageText.trim(),
      timestamp: new Date(),
    };

    this.socketService.sendMessage(this.activeRoomId, newMsg);
    this.messageText = '';
  }

  handleTyping() {
    if (!this.activeRoomId || !this.currentUser()) return;
    this.socketService.typing(this.activeRoomId, this.currentUser());
  }

  groupMessagesByDate() {
    const grouped: { [date: string]: any[] } = {};

    this.messages.forEach((msg) => {
      const dateKey = new Date(msg.timestamp).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(msg);
    });

    this.groupedMessages = Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, messages]) => ({
        date,
        messages: messages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      }));
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth <= 768;
    if (!this.isMobile) {
      this.selectedUser = this.selectedUser || null;
    }
  }
}
