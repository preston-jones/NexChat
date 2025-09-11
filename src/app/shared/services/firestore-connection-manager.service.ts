// Firestore Connection Manager
// This service will manage all Firestore listeners to prevent connection overload

import { Injectable, OnDestroy } from '@angular/core';
import { Firestore, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreConnectionManager implements OnDestroy {
  private activeListeners = new Map<string, Unsubscribe>();
  private connectionCount$ = new BehaviorSubject<number>(0);
  private maxConcurrentConnections = 10; // Firestore limit is usually around 10-100

  constructor() {
    // Monitor connection count
    this.connectionCount$.subscribe(count => {
      if (count > this.maxConcurrentConnections) {
        console.warn(`⚠️ Too many Firestore connections (${count}). Consider cleanup.`);
      }
    });
  }

  /**
   * Register a new Firestore listener with automatic cleanup
   */
  registerListener(
    listenerId: string,
    query: any,
    callback: (snapshot: any) => void,
    errorCallback?: (error: any) => void
  ): void {
    // Clean up existing listener if it exists
    this.cleanupListener(listenerId);

    try {
      // Create new listener
      const unsubscribe = onSnapshot(
        query,
        (snapshot: any) => {
          callback(snapshot);
        },
        (error: any) => {
          console.error(`❌ Firestore listener error (${listenerId}):`, error);
          if (errorCallback) {
            errorCallback(error);
          }
          // Auto-retry after error
          this.retryListener(listenerId, query, callback, errorCallback);
        }
      );

      // Store the unsubscribe function
      this.activeListeners.set(listenerId, unsubscribe);
      this.updateConnectionCount();

    } catch (error) {
      console.error(`❌ Failed to register listener ${listenerId}:`, error);
    }
  }

  /**
   * Clean up a specific listener
   */
  cleanupListener(listenerId: string): void {
    const unsubscribe = this.activeListeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.activeListeners.delete(listenerId);
      this.updateConnectionCount();
    }
  }

  /**
   * Clean up all listeners
   */
  cleanupAllListeners(): void {
    
    this.activeListeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`❌ Error cleaning up ${listenerId}:`, error);
      }
    });
    
    this.activeListeners.clear();
    this.updateConnectionCount();
  }

  /**
   * Retry a failed listener with exponential backoff
   */
  private retryListener(
    listenerId: string,
    query: any,
    callback: (snapshot: any) => void,
    errorCallback?: (error: any) => void,
    retryCount = 0
  ): void {
    const maxRetries = 3;
    const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s

    if (retryCount >= maxRetries) {
      console.error(`❌ Max retries reached for listener: ${listenerId}`);
      return;
    }
    
    setTimeout(() => {
      try {
        this.registerListener(listenerId, query, callback, errorCallback);
      } catch (error) {
        console.error(`❌ Retry failed for ${listenerId}:`, error);
        this.retryListener(listenerId, query, callback, errorCallback, retryCount + 1);
      }
    }, backoffTime);
  }

  /**
   * Get current connection count
   */
  getConnectionCount(): number {
    return this.activeListeners.size;
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): 'healthy' | 'warning' | 'critical' {
    const count = this.getConnectionCount();
    if (count <= 5) return 'healthy';
    if (count <= this.maxConcurrentConnections) return 'warning';
    return 'critical';
  }

  private updateConnectionCount(): void {
    this.connectionCount$.next(this.activeListeners.size);
  }

  ngOnDestroy(): void {
    this.cleanupAllListeners();
  }

  /**
   * Debug method to list all active listeners
   */
  debugListeners(): void {
    this.activeListeners.forEach((_, listenerId) => {
    });
  }
}
