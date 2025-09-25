import { Injectable, signal } from '@angular/core';
import { doc, Firestore, updateDoc } from '@angular/fire/firestore';
import { EmojiReaction } from '../../models/emoji-reaction.model';

@Injectable({
  providedIn: 'root'
})
export class EmojiReactionService {
  // Signals for reactive UI state
  showEmojiPicker = signal(false);
  showEmojiPickerEdit = signal(false);
  showEmojiPickerReact = signal(false);
  selectedMessage = signal<any>(null);

  constructor(private firestore: Firestore) {}

  // Toggle emoji picker for new messages
  toggleEmojiPicker(): void {
    this.showEmojiPickerEdit.set(false);
    setTimeout(() => {
      this.showEmojiPicker.update(value => !value);
    }, 0);
  }

  // Toggle emoji picker for editing messages
  toggleEmojiPickerEdit(): void {
    this.showEmojiPicker.set(false);
    setTimeout(() => {
      this.showEmojiPickerEdit.update(value => !value);
    }, 0);
  }

  // Toggle emoji picker for reactions
  toggleEmojiPickerReact(message: any): void {
    this.showEmojiPicker.set(false);
    this.showEmojiPickerEdit.set(false);
    this.selectedMessage.set(message);
    setTimeout(() => {
      this.showEmojiPickerReact.update(value => !value);
    }, 0);
  }

  // Add emoji to message input
  addEmojiToMessage(emojiEvent: any, messageInput: string): string {
    return messageInput + emojiEvent.emoji.native;
  }

  // Add emoji to edit input
  addEmojiToEdit(emojiEvent: any, editInput: string): string {
    return editInput + emojiEvent.emoji.native;
  }

  // Add or update reaction on a message
  addOrUpdateReaction(message: any, emoji: string, currentUser: any): void {
    if (!currentUser?.id) {
      console.warn('No user found for reaction');
      return;
    }

    const senderID = currentUser.id;
    const senderName = currentUser.name || '';
    
    // Ensure reactions array exists
    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    const emojiReaction = message.reactions.find(
      (r: EmojiReaction) => r.emoji === emoji
    );

    if (emojiReaction) {
      this.updateExistingReaction(emojiReaction, message, senderID, senderName);
    } else {
      this.addNewReaction(message, emoji, senderID, senderName);
    }

    this.updateMessageReactions(message);
  }

  // Handle reaction from emoji picker
  addEmojiReaction(emojiEvent: any, currentUser: any): void {
    const message = this.selectedMessage();
    if (message) {
      this.addOrUpdateReaction(message, emojiEvent.emoji.native, currentUser);
      this.showEmojiPickerReact.set(false);
    }
  }

  // Close all emoji pickers when clicking outside
  handleClickOutside(target: HTMLElement): void {
    if (!target.closest('emoji-mart') && !target.closest('.message-icon')) {
      this.showEmojiPicker.set(false);
      this.showEmojiPickerEdit.set(false);
      this.showEmojiPickerReact.set(false);
    }
  }

  // Format sender names for reaction display
  formatSenderNames(senderNames: string, senderIDs: string, currentUserID: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    
    const formattedNames = senderNameList.map((name, index) => {
      return senderIDList[index] === currentUserID ? 'Du' : name;
    });

    if (formattedNames.length > 2) {
      const otherCount = formattedNames.length - 1;
      return `Du und ${otherCount} weitere Personen`;
    } else if (formattedNames.length === 2) {
      return `${formattedNames[0]} und ${formattedNames[1]}`;
    }
    return formattedNames[0];
  }

  // Get appropriate reaction verb
  getReactionVerb(senderNames: string, senderIDs: string, currentUserID: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    
    const formattedNames = senderNameList.map((name, index) => {
      return senderIDList[index] === currentUserID ? 'Du' : name;
    });

    if (formattedNames.length === 1 && formattedNames[0] === 'Du') {
      return 'hast reagiert';
    }
    if (formattedNames.length === 1) {
      return 'hat reagiert';
    }
    return 'haben reagiert';
  }

  private updateExistingReaction(
    emojiReaction: EmojiReaction, 
    message: any, 
    senderID: string, 
    senderName: string
  ): void {
    const senderIDs = emojiReaction.senderID ? emojiReaction.senderID.split(', ') : [];
    const senderNames = emojiReaction.senderName ? emojiReaction.senderName.split(', ') : [];
    const currentUserIndex = senderIDs.indexOf(senderID);

    if (currentUserIndex > -1) {
      // Remove reaction
      senderIDs.splice(currentUserIndex, 1);
      senderNames.splice(currentUserIndex, 1);
      emojiReaction.count -= 1;

      if (emojiReaction.count === 0) {
        const emojiIndex = message.reactions.indexOf(emojiReaction);
        message.reactions.splice(emojiIndex, 1);
      } else {
        emojiReaction.senderID = senderIDs.join(', ');
        emojiReaction.senderName = senderNames.join(', ');
      }
    } else {
      // Add reaction
      emojiReaction.count += 1;
      emojiReaction.senderID += (emojiReaction.senderID ? ', ' : '') + senderID;
      emojiReaction.senderName += (emojiReaction.senderName ? ', ' : '') + senderName;
    }
  }

  private addNewReaction(message: any, emoji: string, senderID: string, senderName: string): void {
    message.reactions.push({
      emoji: emoji,
      senderID: senderID,
      senderName: senderName,
      count: 1
    });
  }

  private async updateMessageReactions(message: any): Promise<void> {
    const messageDocRef = doc(this.firestore, `messages/${message.messageId}`);
    try {
      await updateDoc(messageDocRef, { reactions: message.reactions });
    } catch (error) {
      console.error('Error updating message reactions:', error);
    }
  }
}