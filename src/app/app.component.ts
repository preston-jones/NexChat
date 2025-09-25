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
    // Only after app has been running for a while to avoid refresh issues
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        // Delay to distinguish from navigation/refresh
        setTimeout(async () => {
          if (document.visibilityState === 'hidden') {
            await this.authService.handleBrowserClose();
          }
        }, 3000); // 3 second delay
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
