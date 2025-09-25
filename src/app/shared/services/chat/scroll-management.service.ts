import { Injectable, signal, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollManagementService {
  // Signals for reactive state
  preventScroll = signal(false);
  scrollToMessageId = signal<string | null>(null);

  // Subjects for event communication
  private scrollToBottomSubject = new Subject<void>();
  private clearAndFocusSubject = new Subject<void>();
  
  // Observables for components to subscribe to
  scrollToBottom$ = this.scrollToBottomSubject.asObservable();
  clearAndFocus$ = this.clearAndFocusSubject.asObservable();

  constructor() {}

  // Scroll to bottom of chat window
  scrollToBottom(chatWindow?: ElementRef): void {
    if (this.preventScroll()) {
      this.preventScroll.set(false);
      return;
    }

    if (chatWindow?.nativeElement) {
      try {
        const element = chatWindow.nativeElement;
        element.scrollTop = element.scrollHeight;
      } catch (error) {
        console.warn('Could not scroll to bottom:', error);
        // Retry after a short delay
        setTimeout(() => {
          if (chatWindow?.nativeElement) {
            chatWindow.nativeElement.scrollTop = chatWindow.nativeElement.scrollHeight;
          }
        }, 100);
      }
    }
  }

  // Set up mutation observer for auto-scrolling
  setupAutoScroll(chatWindow: ElementRef, callback?: () => void): MutationObserver {
    const observer = new MutationObserver(() => {
      if (!this.preventScroll()) {
        if (this.scrollToMessageId()) {
          this.scrollToMessage(chatWindow);
        } else {
          this.scrollToBottom(chatWindow);
        }
      }
      callback?.();
    });

    observer.observe(chatWindow.nativeElement, { 
      childList: true, 
      subtree: true 
    });

    return observer;
  }

  // Scroll to a specific message
  scrollToMessage(chatWindow?: ElementRef): void {
    const messageId = this.scrollToMessageId();
    if (!messageId || !chatWindow?.nativeElement) return;

    const messageElement = chatWindow.nativeElement.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight the message briefly
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
      
      // Reset scroll to message ID
      this.scrollToMessageId.set(null);
    }
  }

  // Clear input and focus textarea
  clearAndFocusTextarea(
    textarea?: ElementRef<HTMLTextAreaElement>, 
    messageInput?: { set: (value: string) => void }
  ): void {
    if (textarea?.nativeElement) {
      messageInput?.set('');
      textarea.nativeElement.focus();
    } else {
      // Retry with delay if element not ready
      setTimeout(() => {
        if (textarea?.nativeElement) {
          messageInput?.set('');
          textarea.nativeElement.focus();
        }
      }, 100);
    }
  }

  // Emit scroll to bottom event
  emitScrollToBottom(): void {
    this.scrollToBottomSubject.next();
  }

  // Emit clear and focus event
  emitClearAndFocus(): void {
    this.clearAndFocusSubject.next();
  }

  // Set prevent scroll flag
  setPreventScroll(prevent: boolean): void {
    this.preventScroll.set(prevent);
  }

  // Set scroll to message ID
  setScrollToMessage(messageId: string): void {
    this.scrollToMessageId.set(messageId);
  }

  // Schedule scroll to bottom with delay
  scheduleScrollToBottom(delay: number = 100): void {
    setTimeout(() => {
      this.emitScrollToBottom();
    }, delay);
  }
}