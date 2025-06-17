import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  //If user already exists in signal
  const user = authService.currentUser();

  if (user) return true;

  // Else: Try to fetch current user from API
  return authService.fetchCurrentUser().pipe(
    map((user) => {
      if (user) return true;
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
