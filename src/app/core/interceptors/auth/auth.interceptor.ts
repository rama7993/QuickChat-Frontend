import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../../services/alerts/alert.service';
import { AuthService } from '../../services/auth/auth.service';
import { SafeStorageService } from '../../services/storage/safe-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const safeStorage = inject(SafeStorageService);
  const token = safeStorage.get('authToken');

  const clonedReq = req.clone({
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(clonedReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        const router = inject(Router);
        const alertService = inject(AlertService);
        const authService = inject(AuthService);

        // Show error message
        alertService.errorToaster('Unauthorized: You have been logged out.');

        // Clear token from storage
        safeStorage.remove('authToken');

        // Call auth service logout for complete cleanup
        authService.logout();

        // Navigate to login
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
