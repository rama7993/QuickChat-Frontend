import {
  HttpInterceptorFn,
  HttpResponse,
  HttpEvent,
} from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

/**
 * Unwraps backend responses that follow the
 * { success, message, data } convention so the rest of the
 * application can keep working with the raw payload.
 */
export const apiResponseInterceptor: HttpInterceptorFn = (
  req,
  next
): Observable<HttpEvent<unknown>> => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body;

        if (body && typeof body === 'object' && 'data' in body) {
          return event.clone({ body: (body as any).data });
        }
      }

      return event;
    })
  );
};
