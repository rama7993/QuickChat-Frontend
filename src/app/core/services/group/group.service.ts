import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Group, GroupSettings } from '../../interfaces/group.model';
import { Message } from '../../interfaces/message.model';
import { User } from '../../interfaces/group.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // GROUPS
  createGroup(
    name: string,
    description: string,
    members: string[],
    groupType: string = 'private',
    settings?: Partial<GroupSettings>
  ): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups`, {
      name,
      description,
      members,
      groupType,
      settings,
    });
  }

  getMyGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/groups/my`);
  }

  getGroupDetails(groupId: string): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/groups/${groupId}`);
  }

  updateGroup(
    groupId: string,
    name?: string,
    description?: string,
    settings?: Partial<GroupSettings>
  ): Observable<Group> {
    return this.http.put<Group>(`${this.apiUrl}/groups/${groupId}`, {
      name,
      description,
      settings,
    });
  }

  deleteGroup(groupId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/groups/${groupId}`
    );
  }

  // MEMBERS
  addMembers(groupId: string, memberIds: string[]): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups/${groupId}/members`, {
      memberIds,
    });
  }

  removeMember(groupId: string, memberId: string): Observable<Group> {
    return this.http.delete<Group>(
      `${this.apiUrl}/groups/${groupId}/members/${memberId}`
    );
  }

  getGroupMembers(
    groupId: string
  ): Observable<{ members: User[]; admins: User[]; totalMembers: number }> {
    return this.http.get<{
      members: User[];
      admins: User[];
      totalMembers: number;
    }>(`${this.apiUrl}/groups/${groupId}/members`);
  }

  getAvailableUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/groups/users/available`);
  }

  // ADMINS
  addAdmin(groupId: string, memberId: string): Observable<Group> {
    return this.http.put<Group>(
      `${this.apiUrl}/groups/${groupId}/admins/${memberId}`,
      {
        action: 'add',
      }
    );
  }

  removeAdmin(groupId: string, memberId: string): Observable<Group> {
    return this.http.put<Group>(
      `${this.apiUrl}/groups/${groupId}/admins/${memberId}`,
      {
        action: 'remove',
      }
    );
  }

  // INVITE
  joinGroupByInviteCode(inviteCode: string): Observable<Group> {
    return this.http.post<Group>(
      `${this.apiUrl}/groups/join/${inviteCode}`,
      {}
    );
  }

  // AVATAR
  uploadGroupAvatar(groupId: string, file: File): Observable<Group> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.http.post<Group>(
      `${this.apiUrl}/groups/${groupId}/avatar`,
      formData
    );
  }

  // PINNED MESSAGES
  pinMessage(groupId: string, messageId: string): Observable<Group> {
    return this.http.put<Group>(
      `${this.apiUrl}/groups/${groupId}/pin/${messageId}`,
      {
        action: 'pin',
      }
    );
  }

  unpinMessage(groupId: string, messageId: string): Observable<Group> {
    return this.http.put<Group>(
      `${this.apiUrl}/groups/${groupId}/pin/${messageId}`,
      {
        action: 'unpin',
      }
    );
  }

  // UTILITY METHODS
  isUserAdmin(group: Group, userId: string): boolean {
    return (
      group.admins.some((admin) => admin._id === userId) ||
      group.createdBy._id === userId
    );
  }

  isUserMember(group: Group, userId: string): boolean {
    return group.members.some((member) => member._id === userId);
  }

  getGroupDisplayName(group: Group): string {
    return group.name || 'Unnamed Group';
  }

  getGroupAvatar(group: Group): string {
    return group.avatar || '/assets/default-group-avatar.png';
  }

  formatLastActivity(lastActivity: Date): string {
    const now = new Date();
    const diffInHours =
      (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Active now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 168) {
      // 7 days
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return new Date(lastActivity).toLocaleDateString();
    }
  }

  getMemberCount(group: Group): number {
    return group.members.length;
  }

  getOnlineMembers(group: Group): number {
    return group.members.filter((member) => member.status === 'online').length;
  }
}
