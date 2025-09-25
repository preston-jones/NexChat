import { Injectable, signal } from '@angular/core';
import { User } from '../../models/user.class';
import { Channel } from '../../models/channel.class';

@Injectable({
  providedIn: 'root'
})
export class MessageSearchService {
  // Reactive state using signals
  searchQuery = signal('');
  isSearching = signal(false);
  isUserSelect = signal(false);
  isChannelSelect = signal(false);
  filteredUsers = signal<User[]>([]);
  filteredChannels = signal<Channel[]>([]);
  markedUsers = signal<{ id: string; name: string }[]>([]);
  markedChannels = signal<{ id: string; name: string }[]>([]);

  // Update search query based on textarea input
  updateSearchQuery(inputValue: string): void {
    const lastAtIndex = inputValue.lastIndexOf('@');
    const lastHashIndex = inputValue.lastIndexOf('#');

    if (lastAtIndex !== -1 && (lastAtIndex > lastHashIndex || lastHashIndex === -1)) {
      // Search for users with @
      const query = inputValue.slice(lastAtIndex + 1).trim().toLowerCase();
      this.searchQuery.set(query);
      this.isChannelSelect.set(false);
      this.isUserSelect.set(true);
      this.isSearching.set(true);
    } else if (lastHashIndex !== -1) {
      // Search for channels with #
      const query = inputValue.slice(lastHashIndex + 1).trim().toLowerCase();
      this.searchQuery.set(query);
      this.isUserSelect.set(false);
      this.isChannelSelect.set(true);
      this.isSearching.set(true);
    } else {
      // No search active
      this.resetSearch();
    }
  }

  // Search users and channels based on current query
  performSearch(allUsers: User[], allChannels: Channel[], currentUserId?: string): void {
    const query = this.searchQuery().toLowerCase();

    if (this.isUserSelect()) {
      const filtered = allUsers.filter(user =>
        user.name.toLowerCase().startsWith(query) ||
        (user.email && user.email.toLowerCase().startsWith(query))
      );
      this.filteredUsers.set(filtered);
      this.filteredChannels.set([]);
    } else if (this.isChannelSelect()) {
      const filtered = allChannels.filter(channel =>
        channel.name.toLowerCase().startsWith(query) &&
        channel.memberUids &&
        currentUserId &&
        channel.memberUids.includes(currentUserId)
      );
      this.filteredChannels.set(filtered);
      this.filteredUsers.set([]);
    }
  }

  // Select a user and update message input
  selectUser(user: User, currentMessage: string): { updatedMessage: string, shouldResetSearch: boolean } {
    if (!user?.id) {
      console.error('Invalid user:', user);
      return { updatedMessage: currentMessage, shouldResetSearch: false };
    }

    // Remove the last '@' and add the complete username
    let updatedMessage = currentMessage.trim();
    const lastAtIndex = updatedMessage.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      updatedMessage = updatedMessage.slice(0, lastAtIndex);
    }
    updatedMessage += ` @${user.name} `;

    // Add user to marked users if not already present
    const currentMarked = this.markedUsers();
    if (!currentMarked.some(u => u.id === user.id)) {
      this.markedUsers.set([...currentMarked, { id: user.id, name: user.name }]);
    }

    this.resetSearch();
    return { updatedMessage, shouldResetSearch: true };
  }

  // Select a channel and update message input
  selectChannel(channel: Channel, currentMessage: string): { updatedMessage: string, shouldResetSearch: boolean } {
    if (!channel?.id) {
      console.error('Invalid channel:', channel);
      return { updatedMessage: currentMessage, shouldResetSearch: false };
    }

    // Remove the last '#' and add the complete channel name
    let updatedMessage = currentMessage.trim();
    const lastHashIndex = updatedMessage.lastIndexOf('#');
    
    if (lastHashIndex !== -1) {
      updatedMessage = updatedMessage.slice(0, lastHashIndex);
    }
    updatedMessage += ` ${channel.name} `;

    // Add channel to marked channels if not already present
    const currentMarked = this.markedChannels();
    if (!currentMarked.some(c => c.id === channel.id)) {
      this.markedChannels.set([...currentMarked, { id: channel.id, name: channel.name }]);
    }

    this.resetSearch();
    return { updatedMessage, shouldResetSearch: true };
  }

  // Reset search state
  resetSearch(): void {
    this.searchQuery.set('');
    this.isSearching.set(false);
    this.isUserSelect.set(false);
    this.isChannelSelect.set(false);
    this.filteredUsers.set([]);
    this.filteredChannels.set([]);
  }

  // Clear all marked items
  clearMarkedItems(): void {
    this.markedUsers.set([]);
    this.markedChannels.set([]);
  }

  // Get current marked user details for message creation
  getMarkedUserDetails(): { id: string; name: string }[] {
    return this.markedUsers();
  }
}