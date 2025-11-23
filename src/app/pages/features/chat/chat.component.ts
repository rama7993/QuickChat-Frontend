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

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatSidebarComponent, ChatWindowComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  public isMobile = false;
  public showSidebar = true;

  ngOnInit() {
    this.checkScreenSize();
  }

  ngOnDestroy() {
    // Component cleanup handled by child components
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;

    // Reset sidebar visibility when switching between mobile/desktop
    if (wasMobile !== this.isMobile) {
      this.showSidebar = true;
    }
  }

  onChatSelected() {
    if (this.isMobile) {
      this.showSidebar = false;
    }
  }

  onBackClicked() {
    if (this.isMobile) {
      this.showSidebar = true;
    }
  }
}
