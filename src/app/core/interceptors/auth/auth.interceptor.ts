import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../../services/alerts/alert.service';
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
        alertService.errorToaster('Unauthorized: You have been logged out.');
        safeStorage.remove('authToken'); // 🔑 Clear token
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
