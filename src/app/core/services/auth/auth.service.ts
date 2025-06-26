import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly userSignal = signal<any | null>(null);

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http
      .post<{ user: any; token: string }>(`${this.API_URL}/auth/login`, {
        email,
        password,
      })
      .pipe(
        tap((res) => {
          localStorage.setItem('authToken', res.token); // ✅ store token
          this.updateUser(res.user);
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
    localStorage.removeItem('authToken'); // ✅ Clear token manually
    this.userSignal.set(null);
  }

  fetchCurrentUser(): Observable<any> {
    return this.http
      .get(`${this.API_URL}/users/me`)
      .pipe(tap((user) => this.userSignal.set(user)));
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
}
