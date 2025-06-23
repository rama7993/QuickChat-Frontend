import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../../services/alerts/alert.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const clonedReq = req.clone({
    withCredentials: true, // 🟢 Send cookies
  });

  return next(clonedReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        const router = inject(Router);
        const alertService = inject(AlertService);
        alertService.errorToaster('Unauthorized: You have been logged out.');
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
