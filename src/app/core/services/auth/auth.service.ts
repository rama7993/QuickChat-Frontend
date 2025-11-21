import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SafeStorageService } from '../storage/safe-storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly userSignal = signal<any | null>(null);
  private readonly tokenRefreshSubject = new BehaviorSubject<boolean>(false);
  private refreshTimer?: any;
  private safeStorage = inject(SafeStorageService);

  constructor(private http: HttpClient) {
    this.initializeTokenRefresh();
  }

  login(email: string, password: string): Observable<any> {
    return this.http
      .post<{ user: any; token: string }>(`${this.API_URL}/auth/login`, {
        email,
        password,
      })
      .pipe(
        tap((res) => {
          this.safeStorage.set('authToken', res.token);
          this.updateUser(res.user);
          this.startTokenRefreshTimer();
        })
      );
  }

  register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/register`, data);
  }

  logout(): void {
    // Clear token from storage
    this.safeStorage.remove('authToken');

    // Clear user signal
    this.userSignal.set(null);

    // Clear any other auth-related data
    this.safeStorage.remove('user');
    this.safeStorage.remove('rememberMe');

    // Stop token refresh timer
    this.stopTokenRefreshTimer();
  }

  fetchCurrentUser(): Observable<any> {
    return this.http.get(`${this.API_URL}/users/me`).pipe(
      tap((user) => {
        this.userSignal.set(user);
      })
    );
  }

  get currentUser() {
    return this.userSignal.asReadonly();
  }

  updateUser(user: any) {
    this.userSignal.set(user);
  }

  getUsers(): Observable<any> {
    return this.http.get(`${this.API_URL}/users`);
  }

  updateUserById(id: string, userData: any): Observable<any> {
    return this.http.put(`${this.API_URL}/users/${id}`, userData);
  }

  uploadProfilePicture(formData: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/upload/profile-picture`, formData);
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/change-password`, {
      oldPassword,
      newPassword,
    });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/reset-password`, {
      token,
      password,
    });
  }

  // Refresh token before it expires
  refreshToken(): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/refresh`, {}).pipe(
      tap((response: any) => {
        if (response.token) {
          this.safeStorage.set('authToken', response.token);
          this.tokenRefreshSubject.next(true);
          this.startTokenRefreshTimer(); // Restart timer with new token
        }
      }),
      catchError((error) => {
        // If refresh fails, logout user
        this.logout();
        return of(null);
      })
    );
  }

  // Check if current token is valid
  validateToken(): Observable<any> {
    return this.http.get(`${this.API_URL}/auth/validate`);
  }

  // Check if user is logged in (has valid token)
  isLoggedIn(): boolean {
    const token = this.safeStorage.get('authToken');

    if (!token) {
      return false;
    }

    // Check if token is expired (basic check)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp <= now;
      return !isExpired;
    } catch (error) {
      return false;
    }
  }

  // Get token expiration time in seconds
  getTokenExpirationTime(): number | null {
    const token = this.safeStorage.get('authToken');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp;
    } catch (error) {
      return null;
    }
  }

  // Get time until token expires in seconds
  getTimeUntilExpiration(): number | null {
    const expTime = this.getTokenExpirationTime();
    if (!expTime) return null;

    const now = Math.floor(Date.now() / 1000);
    return expTime - now;
  }

  // Initialize token refresh mechanism
  private initializeTokenRefresh(): void {
    // Check if user is logged in and start refresh timer
    if (this.isLoggedIn()) {
      this.startTokenRefreshTimer();
    }
  }

  // Start token refresh timer
  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer(); // Clear existing timer

    const timeUntilExpiration = this.getTimeUntilExpiration();
    if (!timeUntilExpiration || timeUntilExpiration <= 0) {
      this.logout();
      return;
    }

    // Refresh token 5 minutes before expiration
    const refreshTime = Math.max(timeUntilExpiration - 300, 60) * 1000;

    this.refreshTimer = setTimeout(() => {
      this.refreshToken().subscribe();
    }, refreshTime);
  }

  // Stop token refresh timer
  private stopTokenRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  // Get token refresh observable
  getTokenRefreshObservable(): Observable<boolean> {
    return this.tokenRefreshSubject.asObservable();
  }
}
