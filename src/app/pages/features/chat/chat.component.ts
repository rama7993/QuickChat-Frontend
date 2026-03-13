import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { signal } from '@angular/core';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatSidebarComponent, ChatWindowComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit {
  public isMobile = signal(false);
  public showSidebar = signal(true);

  ngOnInit() {
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    const wasMobile = this.isMobile();
    const currentIsMobile = window.innerWidth <= 768;
    this.isMobile.set(currentIsMobile);

    if (wasMobile !== currentIsMobile) {
      this.showSidebar.set(true);
    }
  }

  onChatSelected() {
    if (this.isMobile()) {
      this.showSidebar.set(false);
    }
  }

  onBackClicked() {
    if (this.isMobile()) {
      this.showSidebar.set(true);
    }
  }
}
