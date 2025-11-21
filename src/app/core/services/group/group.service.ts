import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Group, User } from '../../interfaces/group.model';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all groups for the current user
   */
  getMyGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/groups/my`);
  }

  /**
   * Get available users for adding to a group
   */
  getAvailableUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  /**
   * Create a new group
   */
  createGroup(
    name: string,
    description: string,
    members: string[],
    groupType: 'public' | 'private' | 'secret' = 'public'
  ): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups`, {
      name,
      description,
      members,
      groupType,
    });
  }

  /**
   * Leave a group
   */
  leaveGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/groups/${groupId}/leave`, {
      userId,
    });
  }

  /**
   * Get group by ID
   */
  getGroupById(groupId: string): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/groups/${groupId}`);
  }

  /**
   * Get group details (alias for getGroupById)
   */
  getGroupDetails(groupId: string): Observable<Group> {
    return this.getGroupById(groupId);
  }

  /**
   * Update group
   */
  updateGroup(groupId: string, data: Partial<Group>): Observable<Group> {
    return this.http.put<Group>(`${this.apiUrl}/groups/${groupId}`, data);
  }

  /**
   * Delete group
   */
  deleteGroup(groupId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/groups/${groupId}`);
  }

  /**
   * Add members to group
   */
  addMembers(groupId: string, memberIds: string[]): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups/${groupId}/members`, {
      members: memberIds,
    });
  }

  /**
   * Remove members from group
   */
  removeMembers(groupId: string, memberIds: string[]): Observable<Group> {
    return this.http.delete<Group>(`${this.apiUrl}/groups/${groupId}/members`, {
      body: { members: memberIds },
    });
  }
}
