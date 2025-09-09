import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FirestoreConnectionManager } from './shared/services/firestore-connection-manager.service';

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

  constructor(private connectionManager: FirestoreConnectionManager) {}

  ngOnInit() {
    // Monitor connection health
    setInterval(() => {
      const health = this.connectionManager.getConnectionHealth();
      if (health === 'critical') {
        console.warn('🚨 Firestore connection health critical - consider refreshing');
      }
    }, 30000); // Check every 30 seconds

    // Listen for page unload to cleanup connections
    window.addEventListener('beforeunload', () => {
      this.connectionManager.cleanupAllListeners();
    });

    // Add keyboard shortcut for manual connection cleanup (Ctrl+Shift+R)
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        console.log('🔄 Manual Firestore connection cleanup triggered');
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
