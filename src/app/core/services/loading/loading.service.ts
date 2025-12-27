import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private loadingStates = signal<Map<string, boolean>>(new Map());

  /**
   * Set loading state for a specific key
   */
  setLoading(key: string, isLoading: boolean): void {
    const currentStates = this.loadingStates();
    currentStates.set(key, isLoading);
    this.loadingStates.set(new Map(currentStates));
  }

  /**
   * Check if a specific key is loading
   */
  isLoading(key: string): boolean {
    return this.loadingStates().get(key) || false;
  }

  /**
   * Check if any loading is active
   */
  isAnyLoading(): boolean {
    return Array.from(this.loadingStates().values()).some((loading) => loading);
  }

  /**
   * Get all loading states
   */
  getLoadingStates(): Map<string, boolean> {
    return this.loadingStates();
  }

  /**
   * Clear all loading states
   */
  clearAll(): void {
    this.loadingStates.set(new Map());
  }

  /**
   * Remove a specific loading state
   */
  remove(key: string): void {
    const currentStates = this.loadingStates();
    currentStates.delete(key);
    this.loadingStates.set(new Map(currentStates));
  }
}
