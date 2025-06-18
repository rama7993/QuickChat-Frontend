// socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  private messageSubject = new Subject<any>();
  private typingSubject = new Subject<any>();

  constructor() {
    this.socket = io(environment.socketUrl);

    this.socket.on('connect', () => {
      console.log('[🔌 Socket connected]', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('[❌ Socket disconnected]');
    });

    this.socket.on('chat message', (msg) => {
      //console.log('[📥 Received chat message]', msg);
      this.messageSubject.next(msg);
    });

    this.socket.on('typing', (data) => {
      //console.log('[✍️ Typing event received]', data);
      this.typingSubject.next(data);
    });
  }

  joinRoom(roomId: string) {
    this.socket.emit('join room', roomId);
    console.log('[🚪 Join Room]', roomId);
  }

  leaveRoom(roomId: string) {
    this.socket.emit('leave room', roomId);
    console.log('[🚪 Leave Room]', roomId);
  }

  sendMessage(roomId: string, message: any) {
    //console.log('[📤 Sending message via socket]', roomId, message);
    this.socket.emit('chat message', { roomId, message });
  }

  typing(roomId: string, user: any) {
    //console.log('[✍️ Sending typing event]', roomId, user);
    this.socket.emit('typing', { roomId, user });
  }

  onMessage(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  onTyping(): Observable<any> {
    return this.typingSubject.asObservable();
  }

  disconnect() {
    this.socket.disconnect();
    console.log('[❌ Disconnected socket]');
  }
}
