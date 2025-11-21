import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private isProduction = environment.production;

  log(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(`[LOG] ${message}`, ...args);
    }
  }

  error(message: string, error?: any): void {
    if (!this.isProduction) {
      console.error(`[ERROR] ${message}`, error);
    }
    // In production, you might want to send errors to a logging service
    // Example: Sentry, LogRocket, etc.
  }

  warn(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}
