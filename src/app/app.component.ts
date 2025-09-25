import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FirestoreConnectionManager } from './shared/services/firestore-connection-manager.service';
import { AuthService } from './shared/services/authentication/auth-service/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: [
    './app.component.scss',
    '../styles.scss'
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'NexChat';

  constructor(
    private connectionManager: FirestoreConnectionManager,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Monitor connection health
    setInterval(() => {
      const health = this.connectionManager.getConnectionHealth();
      if (health === 'critical') {
        console.warn('🚨 Firestore connection health critical - consider refreshing');
      }
    }, 30000); // Check every 30 seconds

    // Listen for page unload to cleanup connections only
    window.addEventListener('beforeunload', (event) => {
      this.connectionManager.cleanupAllListeners();
      // Don't update login state on beforeunload - too aggressive
    });

    // Handle visibility change (tab switching, minimizing browser) 
    // Only trigger logout for extended periods of inactivity, not brief tab switches
    let visibilityTimer: any = null;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        // Start timer for extended absence (5 minutes)
        visibilityTimer = setTimeout(async () => {
          // Only trigger if still hidden after extended period
          if (document.visibilityState === 'hidden') {
            console.log('🕒 Extended visibility hidden detected - triggering handleBrowserClose');
            await this.authService.handleBrowserClose();
          }
        }, 300000); // 5 minutes (300000ms) instead of 3 seconds
      } else if (document.visibilityState === 'visible') {
        // Cancel timer if user returns quickly
        if (visibilityTimer) {
          clearTimeout(visibilityTimer);
          visibilityTimer = null;
          console.log('👁️ User returned - cancelling handleBrowserClose timer');
        }
      }
    });

    // Add keyboard shortcut for manual connection cleanup (Ctrl+Shift+R)
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        this.connectionManager.cleanupAllListeners();
        // Brief delay then refresh
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }

  ngOnDestroy() {
    this.connectionManager.cleanupAllListeners();
  }
}
