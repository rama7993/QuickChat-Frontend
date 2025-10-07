import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AlertService } from '../alerts/alert.service';

@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandlerService implements ErrorHandler {
  private alertService = inject(AlertService);

  handleError(error: any): void {
    console.error('Global error caught:', error);

    // Don't show alerts for certain types of errors in production
    if (this.shouldSuppressError(error)) {
      return;
    }

    // Extract meaningful error message
    const errorMessage = this.extractErrorMessage(error);

    // Show user-friendly error message
    this.alertService.errorToaster(errorMessage);

    // In production, you might want to send errors to a logging service
    if (this.isProduction()) {
      this.logErrorToService(error);
    }
  }

  private shouldSuppressError(error: any): boolean {
    // Suppress certain types of errors that shouldn't show to users
    const suppressedErrors = [
      'ChunkLoadError',
      'Loading chunk',
      'Loading CSS chunk',
      'ResizeObserver loop limit exceeded',
    ];

    return suppressedErrors.some((suppressedError) =>
      error.message?.includes(suppressedError)
    );
  }

  private extractErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message;
    }

    if (error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  private isProduction(): boolean {
    return (
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')
    );
  }

  private logErrorToService(error: any): void {
    // In production, send errors to your logging service
    // Example: Sentry, LogRocket, or your own error tracking service
    try {
      // Example implementation:
      // this.loggingService.logError(error);
      // console.log('Error logged to service:', error); // Commented for production
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError);
    }
  }
}
