import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Group } from '../../interfaces/group.model';
import { Message } from '../../interfaces/message.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // GROUPS
  createGroup(name: string, members: string[]): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups`, { name, members });
  }

  getMyGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/groups/my`);
  }

  // MESSAGES
  getGroupMessages(groupId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/messages/group/${groupId}`);
  }

  sendGroupMessage(groupId: string, content: string): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/messages/group`, {
      groupId,
      content,
    });
  }
}
