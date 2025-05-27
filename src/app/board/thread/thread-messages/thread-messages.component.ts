import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Input, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Message } from '../../../shared/models/message.class';
import { doc, Firestore, updateDoc } from '@angular/fire/firestore';
import { getDoc } from 'firebase/firestore';
import { SendMessageService } from '../../../shared/services/messages/send-message.service';
import { AuthService } from '../../../shared/services/authentication/auth-service/auth.service';
import { MessagesService } from '../../../shared/services/messages/messages.service';

@Component({
  selector: 'app-thread-messages',
  standalone: true,
  imports: [
    MatIconModule,
    FormsModule,
    CommonModule,
    PickerComponent,
  ],
  templateUrl: './thread-messages.component.html',
  styleUrl: './thread-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})

export class ThreadMessagesComponent {
  @Input() selectedMessage: Message | null = null;
  @Input() messages: Message[] = [];

  senderName: string | null = null;
  senderID: string | null = null;
  reactions: { emoji: string, senderID: string, senderName: string, count: number }[] = [];
  selectedMessageId: string | null = null;
  showEmojiPicker = false;
  showMessageEdit = false;
  showMessageEditArea = false;
  editingMessageId: string | null = null;
  editingMessage: string | null = null;

  constructor(private firestore: Firestore,
    private cd: ChangeDetectorRef,
    private authService: AuthService,
    public sendMessageService: SendMessageService,
    public messagesService: MessagesService,
  ) { }

  ngOnInit(): void {
    const userSignal = this.authService.getUserSignal();

    if (userSignal) {
      const user = userSignal();
      this.senderName = user ? user.name : null;
      this.senderID = user ? user.id : null;
    } else {
      console.error('Fehler: Benutzer-Signal ist null oder undefined');
    }
  }

  toggleEditBtn() {
    this.showMessageEdit = !this.showMessageEdit;
  }

  isEditing(docId: string): boolean {
    return this.editingMessageId === docId;
  }

  enableEditMode(docId: string, message: Message) {
    this.editingMessageId = docId;
    this.editingMessage = message.message;
    this.showMessageEditArea = true;
    this.showMessageEdit = false;
  }

  cancelEditMode(message: Message) {
    if (this.editingMessage !== null) {
      message.message = this.editingMessage;
    }
    this.resetEditState();
  }

  resetEditState() {
    this.editingMessageId = null;
    this.editingMessage = null;
    this.showMessageEditArea = false;
  }

  async saveEditedMessage(message: Message) {
    if (this.editingMessageId && this.selectedMessage) {
      const messageRef = doc(this.firestore, `messages/${this.selectedMessage.messageId}`);
      const docSnap = await getDoc(messageRef);

      if (docSnap.exists()) {
        const mainMessage = docSnap.data();
        const answers = mainMessage['answers'] || [];
        const answerToUpdate = answers.find((answer: any) => answer.messageId === this.editingMessageId);

        if (answerToUpdate) {
          answerToUpdate.message = message.message;
          await updateDoc(messageRef, { answers });
          this.resetEditState();
          this.cd.detectChanges();
        }
      }
    }
  }

  showEmoji(messageId: string) {
    this.selectedMessageId = messageId;
    this.showEmojiPicker = true;
  }

  addEmoji(event: any): void {
    const emoji = event.emoji.native;

    if (this.selectedMessageId && this.isEditing(this.selectedMessageId)) {
      this.appendEmojiToEditedMessage(emoji);
    } else if (this.selectedMessageId) {
      const messageToUpdate = this.findMessageToUpdate();

      if (!messageToUpdate) {
        return;
      }
      this.addOrUpdateReaction(messageToUpdate, emoji);
      this.updateMessageReactions(messageToUpdate);

    }

    this.showEmojiPicker = false;
  }

  private appendEmojiToEditedMessage(emoji: string): void {
    const messageToUpdate = this.messages.find((msg) => msg.messageId === this.selectedMessageId);

    if (messageToUpdate) {
      messageToUpdate.message += emoji;
    }
  }

  private findMessageToUpdate(): Message | null {
    let messageToUpdate = this.messages.find(msg => msg.messageId === this.selectedMessageId) || null;
    if (!messageToUpdate) {
      messageToUpdate = this.selectedMessage || null;
    }
    return messageToUpdate;
  }

  addOrUpdateReaction(message: Message, emoji: string): void {
    this.selectedMessageId = message.messageId;
    const senderID = this.senderID || '';
    const emojiReaction = message.reactions.find(r => r.emoji === emoji);

    if (emojiReaction) {
      const senderIDs = emojiReaction.senderID.split(', ');
      const senderNames = emojiReaction.senderName.split(', ');
      const currentUserIndex = senderIDs.indexOf(senderID);

      if (currentUserIndex > -1) {
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
        emojiReaction.count += 1;
        emojiReaction.senderID += (emojiReaction.senderID ? ', ' : '') + senderID;
        emojiReaction.senderName += (emojiReaction.senderName ? ', ' : '') + this.senderName;
      }
    } else {
      message.reactions.push({
        emoji: emoji,
        senderID: senderID,
        senderName: this.senderName || '',
        count: 1
      });
    }

    this.updateMessageReactions(message);
  }

  formatSenderNames(senderNames: string, senderIDs: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    const currentUserID = this.senderID || '';
    const formattedNames = senderNameList.map((name, index) => {
      return senderIDList[index] === currentUserID ? 'Du' : name;
    });

    if (formattedNames.length > 1) {
      const lastSender = formattedNames.pop();
      return formattedNames.join(', ') + ' und ' + lastSender;
    }
    return formattedNames[0];
  }

  getReactionVerb(senderNames: string, senderIDs: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    const currentUserID = this.senderID || '';
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


  async updateMessageReactions(message: Message) {
    if (!this.selectedMessageId) {
      console.error('Fehlende selectedMessageId.');
      return;
    }
    try {
      const messageRef = doc(this.firestore, `messages/${this.selectedMessage?.messageId}`);
      const docSnap = await getDoc(messageRef);

      if (docSnap.exists()) {
        const mainMessage = docSnap.data();
        if (this.isMainMessage()) {
          await this.updateMainMessageReactions(message, mainMessage, messageRef);
        } else {
          await this.updateAnswerMessageReactions(message, mainMessage, messageRef);
        }
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Reaktionen: ", error);
    }
  }

  isMainMessage(): boolean {
    return this.selectedMessageId === this.selectedMessage?.messageId;
  }

  async updateMainMessageReactions(message: Message, mainMessage: any, messageRef: any) {
    mainMessage['reactions'] = message.reactions;

    await updateDoc(messageRef, {
      reactions: mainMessage['reactions']
    });
  }

  async updateAnswerMessageReactions(message: Message, mainMessage: any, messageRef: any) {
    const answers = mainMessage['answers'] || [];
    const answerToUpdate = answers.find((answer: any) => answer.messageId === this.selectedMessageId);

    if (answerToUpdate) {
      answerToUpdate['reactions'] = message.reactions;

      await updateDoc(messageRef, {
        answers: answers
      });
    } else {
      console.error('Keine passende Antwort gefunden, um die Reaktionen zu aktualisieren.');
    }
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (this.showEmojiPicker) {
      if (!target.closest('.emoji-box') && !target.closest('.message-icon') && !target.closest('.emoji-btn') && !target.closest('.thread-message-edit-buttons')) {
        this.showEmojiPicker = false;
      }
    }
  }
}
