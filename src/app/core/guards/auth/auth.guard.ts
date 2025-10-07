import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  // Check if token exists in localStorage
  const token = localStorage.getItem('authToken');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) return true;

  // No user in signal: fetch from API
  return authService.fetchCurrentUser().pipe(
    map((user) => {
      if (user) return true;
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      localStorage.removeItem('authToken');
      router.navigate(['/login']);
      return of(false);
    })
  );
};
