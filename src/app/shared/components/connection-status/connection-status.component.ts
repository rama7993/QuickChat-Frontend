import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../../core/services/socket/socket.service';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="connection-status"
      [class.connected]="isConnected()"
      [class.disconnected]="!isConnected()"
      [attr.aria-label]="isConnected() ? 'Connected' : 'Disconnected'"
    >
      <i [class]="isConnected() ? 'pi pi-wifi' : 'pi pi-wifi-off'"></i>
      <span class="status-text">
        {{ isConnected() ? 'Connected' : 'Disconnected' }}
      </span>
    </div>
  `,
  styles: [
    `
      .connection-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        transition: all 0.3s ease;

        &.connected {
          background-color: rgba(34, 197, 94, 0.1);
          color: rgb(34, 197, 94);
        }

        &.disconnected {
          background-color: rgba(239, 68, 68, 0.1);
          color: rgb(239, 68, 68);
          animation: pulse 2s infinite;
        }

        .status-text {
          font-weight: 500;
        }
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
    `,
  ],
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  isConnected = signal(false);

  private onlineListener = () => this.checkConnectionState();
  private offlineListener = () => this.checkConnectionState();

  ngOnInit(): void {
    // Initial check
    this.checkConnectionState();

    // Subscribe to socket connection status
    this.socketService.connectionStatus$.subscribe((_) => {
      this.checkConnectionState();
    });

    // Listen for online/offline events
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener('offline', this.offlineListener);
  }

  private checkConnectionState() {
    const isOnline = navigator.onLine;
    const isSocketConnected = this.socketService.isSocketConnected();
    this.isConnected.set(isOnline ? isSocketConnected : false);
  }
}
