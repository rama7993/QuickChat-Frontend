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
      const router = inject(Router);
      const alertService = inject(AlertService);
      const authService = inject(AuthService);

      // Handle different HTTP error status codes
      switch (error.status) {
        case 401:
          // Unauthorized - Token expired or invalid
          alertService.errorToaster(
            error.error?.message || 'Unauthorized: You have been logged out.'
          );
          safeStorage.remove('authToken');
          authService.logout();
          router.navigate(['/login']);
          break;

        case 403:
          // Forbidden - User doesn't have permission
          alertService.errorToaster(
            error.error?.message ||
              'Access denied. You do not have permission to perform this action.'
          );
          break;

        case 404:
          // Not Found
          if (!error.url?.includes('/api/')) {
            // Only show for API calls, not for missing routes
            alertService.warningToaster(
              error.error?.message || 'Resource not found.'
            );
          }
          break;

        case 409:
          // Conflict - Usually duplicate resource
          alertService.errorToaster(
            error.error?.message ||
              error.error?.error ||
              'This resource already exists.'
          );
          break;

        case 422:
          // Unprocessable Entity - Validation errors
          const validationMessage =
            error.error?.message ||
            error.error?.error ||
            'Validation failed. Please check your input.';
          alertService.errorToaster(validationMessage);
          break;

        case 429:
          // Too Many Requests - Rate limiting
          alertService.warningToaster(
            'Too many requests. Please wait a moment and try again.'
          );
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors
          alertService.errorToaster(
            error.error?.message ||
              'Server error. Please try again later or contact support if the problem persists.'
          );
          break;

        case 0:
          // Network error or CORS issue
          alertService.errorToaster(
            'Network error. Please check your internet connection and try again.'
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
    })
  );
};
