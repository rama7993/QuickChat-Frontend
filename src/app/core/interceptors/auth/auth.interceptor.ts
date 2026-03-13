import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../../services/alerts/alert.service';
import { AuthService } from '../../services/auth/auth.service';
import { SafeStorageService } from '../../services/storage/safe-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const safeStorage = inject(SafeStorageService);
  const router = inject(Router);
  const alertService = inject(AlertService);
  const authService = inject(AuthService);
  const token = safeStorage.get('authToken');

  const clonedReq = req.clone({
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(clonedReq).pipe(
    catchError((error) => {
      switch (error.status) {
        case 401:
          alertService.errorToaster(
            error.error?.message || 'Unauthorized: You have been logged out.',
          );
          safeStorage.remove('authToken');
          authService.logout();
          router.navigate(['/login']);
          break;

        case 403:
          alertService.errorToaster(
            error.error?.message ||
              'Access denied. You do not have permission to perform this action.',
          );
          break;

        case 404:
          if (!error.url?.includes('/api/')) {
            alertService.warningToaster(
              error.error?.message || 'Resource not found.',
            );
          }
          break;

        case 409:
          alertService.errorToaster(
            error.error?.message ||
              error.error?.error ||
              'This resource already exists.',
          );
          break;

        case 422:
          const validationMessage =
            error.error?.message ||
            error.error?.error ||
            'Validation failed. Please check your input.';
          alertService.errorToaster(validationMessage);
          break;

        case 429:
          alertService.warningToaster(
            'Too many requests. Please wait a moment and try again.',
          );
          break;

        case 504:
          alertService.errorToaster(
            error.error?.message ||
              'Server error. Please try again later or contact support if the problem persists.',
          );
          break;

        case 0:
          alertService.errorToaster(
            'Network error. Please check your internet connection and try again.',
          );
          break;

        default:
          // Other errors
          if (error.error?.message) {
            alertService.errorToaster(error.error.message);
          } else if (error.error?.error) {
            alertService.errorToaster(error.error.error);
          }
          break;
      }

      return throwError(() => error);
    }),
  );
};
