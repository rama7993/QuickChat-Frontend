import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Group, User } from '../../interfaces/group.model';
import { SafeStorageService } from '../storage/safe-storage.service';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private readonly apiUrl = environment.apiUrl;
  private groupsCache: Group[] | null = null;
  private groupsCacheTimestamp: number = 0;
  private readonly GROUPS_CACHE_TTL = 60000; // 1 minute cache

  constructor(
    private http: HttpClient,
    private storageService: SafeStorageService
  ) {}

  /**
   * Get all groups for the current user
   */
  getMyGroups(forceRefresh: boolean = false): Observable<Group[]> {
    const now = Date.now();
    const CACHE_KEY = 'chat_groups_cache';
    const CACHE_TIMESTAMP_KEY = 'chat_groups_timestamp';

    // Try to load from memory first
    if (!this.groupsCache) {
      const storedCache = this.storageService.get(CACHE_KEY);
      const storedTimestamp = this.storageService.get(CACHE_TIMESTAMP_KEY);
      if (storedCache && storedTimestamp) {
        this.groupsCache = JSON.parse(storedCache);
        this.groupsCacheTimestamp = parseInt(storedTimestamp, 10);
      }
    }

    const isCacheValid =
      this.groupsCache &&
      now - this.groupsCacheTimestamp < this.GROUPS_CACHE_TTL;

    if (isCacheValid && !forceRefresh) {
      return of(this.groupsCache!);
    }

    return this.http.get<Group[]>(`${this.apiUrl}/groups/my`).pipe(
      tap((groups) => {
        this.groupsCache = groups;
        this.groupsCacheTimestamp = now;
        this.storageService.set(CACHE_KEY, JSON.stringify(groups));
        this.storageService.set(CACHE_TIMESTAMP_KEY, now.toString());
      }),
      catchError((error) => {
        if (this.groupsCache) {
          return of(this.groupsCache);
        }
        throw error;
      })
    );
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
