import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, ElementRef, EventEmitter, HostListener, OnInit, Output, ViewChild, ViewContainerRef, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { addDoc, collection, doc, Firestore, onSnapshot, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { User } from '../../../shared/models/user.class';
import { Channel } from '../../../shared/models/channel.class';
import { UserService } from '../../../shared/services/firestore/user-service/user.service';
import { AuthService } from '../../../shared/services/authentication/auth-service/auth.service';
import { ChannelsService } from '../../../shared/services/channels/channels.service';
import { MessagesService } from '../../../shared/services/messages/messages.service';
import { ChannelDescriptionDialogComponent } from '../../../dialogs/channel-description-dialog/channel-description-dialog.component';
import { Message } from '../../../shared/models/message.class';
import { ChannelNavigationService } from '../../../shared/services/chat/channel-navigation.service';
import { ChatUtilityService } from '../../../shared/services/messages/chat-utility.service';
import { WelcomePageComponent } from '../../../shared/templates/welcome-page/welcome-page.component';
import { EmojiReaction } from '../../../shared/models/emoji-reaction.model';



@Component({
  selector: 'app-channel-message',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, FormsModule,
    MatFormFieldModule, MatInputModule, CommonModule, PickerComponent, NgIf, NgFor, WelcomePageComponent],
  templateUrl: './channel-message.component.html',
  styleUrls: [
    './channel-message.component.scss',
    '../../../../styles.scss',
    '../../../shared/styles/message-editor.scss',
    '../../../shared/styles/message-textfield.scss',
    '../../../shared/styles/chat-window.scss'
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
})
export class ChannelMessageComponent implements OnInit, AfterViewInit {
  messages: Message[] = [];
  selectedMessage: Message | null = null;
  users: User[] = [];
  filteredUsers: User[] = [];
  filteredChannels: Channel[] = [];
  channels: Channel[] = [];
  currentUser = this.authService.currentUser;
  showEmojiPicker: boolean = false;
  showEmojiPickerEdit: boolean = false;
  showEmojiPickerReact: boolean = false;
  showMessageEdit = false;
  showMessageEditArea = false;
  channelChatMessage = '';
  messageArea = true;
  editedMessage: string = '';
  currentUserUid = '';
  editingMessageId: string | null = null;
  senderAvatar: string | null = null;
  senderName: string | null = null;
  searchQuery: string = '';
  isSearching: boolean = false;
  isUserSelect: boolean = false;
  isChannelSelect: boolean = false;
  markedUser: { id: string; name: string }[] = [];
  markedChannel: { id: string; name: string }[] = [];
  private isViewInitialized = false;

  @Output() showThreadEvent = new EventEmitter<Message>();
  @Output() openChannelEvent = new EventEmitter<void>();
  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild('chatMessageTextarea', { static: false }) chatMessageTextarea!: ElementRef<HTMLTextAreaElement>;

  constructor(private firestore: Firestore, private auth: Auth,
    public userService: UserService, private cd: ChangeDetectorRef,
    private authService: AuthService,
    public channelsService: ChannelsService, public dialog: MatDialog,
    public messageService: MessagesService, private channelNavigationService: ChannelNavigationService, private chatUtilityService: ChatUtilityService) { }


  ngOnInit() {
    this.channelsService.clearAndFocusTextarea.subscribe(() => {
      this.clearAndFocusTextarea();
      // Also trigger scroll to bottom when channel is changed
      setTimeout(() => {
        this.scrollToBottom();
      }, 0);
    });

    // Subscribe to channel clicks to trigger scroll
    this.channelsService.clickUserEvent.subscribe(() => {
      setTimeout(() => {
        this.scrollToBottom();
      }, 50);
    });

    this.loadData();
    
    // Schedule scroll to bottom after view is initialized
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }


  clearAndFocusTextarea() {
    if (this.isViewInitialized && this.chatMessageTextarea && this.chatMessageTextarea.nativeElement) {
      this.channelChatMessage = ''; // Clear the input field
      this.chatMessageTextarea.nativeElement.focus(); // Set focus on the input field
    } else {
      console.warn('chatMessageTextarea is not initialized or view is not ready.');
    }
  }


  ngAfterViewInit() {
    this.isViewInitialized = true;
    this.clearAndFocusTextarea();
    
    // Ensure scrollToBottom is called after view is initialized
    setTimeout(() => {
      this.scrollToBottom();
    }, 0);
    
    if (this.chatWindow) {
      const observer = new MutationObserver(() => {
        if (!this.channelsService.preventScroll) {
          this.scrollToBottom();
        }
      });
      observer.observe(this.chatWindow.nativeElement, { childList: true, subtree: true });
    }
  }


  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.loadUsers();
        this.channelsService.loadChannels();
      } else {
      }
    });
  }


  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));
    let allUsers:any = [];

    onSnapshot(usersQuery, async (snapshot) => {
      this.users = await Promise.all(snapshot.docs.map(async (doc) => {
        let userData = doc.data() as User;
        allUsers.push(userData);

        return { ...userData, id: doc.id };
      }));

    });
  }

  scrollToBottom() {
    if (this.channelsService.preventScroll) {
      this.channelsService.preventScroll = false; // Reset the flag
      return; // Prevent scrolling
    }
    
    if (this.chatWindow && this.chatWindow.nativeElement) {
      try {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      } catch (error) {
        console.warn('Could not scroll to bottom:', error);
        // Retry after a short delay if element is not ready
        setTimeout(() => {
          if (this.chatWindow && this.chatWindow.nativeElement) {
            this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
          }
        }, 100);
      }
    } else {
      console.warn('ChatWindow not available for scrolling');
    }
  }

  toggleSearch(): void {
    this.isUserSelect = !this.isUserSelect; // Suchstatus umschalten
    if (this.isUserSelect) {
      this.onSearch();
    } else {
      this.filteredUsers = []; // Gefilterte Liste zurücksetzen, wenn keine Suche aktiv ist
    }
  }

  updateSearchQuery(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const fullText = target.value;

    // Überprüfen, ob der Text mit @ oder # beginnt
    const lastAtIndex = fullText.lastIndexOf('@');
    const lastHashIndex = fullText.lastIndexOf('#');

    if (lastAtIndex !== -1 && (lastAtIndex > lastHashIndex || lastHashIndex === -1)) {
      // Suche nach Benutzern mit @
      this.searchQuery = fullText.slice(lastAtIndex + 1).trim().toLowerCase();
      this.isChannelSelect = false;
      this.isUserSelect = true; // Benutzer suchen
      this.isSearching = true;
      this.onSearch();
    } else if (lastHashIndex !== -1) {
      // Suche nach Kanälen mit #
      this.searchQuery = fullText.slice(lastHashIndex + 1).trim().toLowerCase();
      this.isUserSelect = false; // Kanäle suchen
      this.isChannelSelect = true;
      this.isSearching = true;
      this.onSearch();
    } else {
      // Keine Suche aktiv, Liste zurücksetzen
      this.searchQuery = '';
      this.isSearching = false;
      this.filteredUsers = [];
      this.filteredChannels = [];
    }
  }


  selectChannel(channel: Channel) {
    if (channel && channel.id) {
      // Entferne das letzte '@' und füge den vollständigen Benutzernamen hinzu
      this.channelChatMessage = this.channelChatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.channelChatMessage.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.channelChatMessage = this.channelChatMessage.slice(0, lastAtIndex);
      }

      this.channelChatMessage += ` ${channel.name} `;

      if (!this.markedChannel.some(c => c.id === channel.id)) {
        this.markedChannel.push({ id: channel.id, name: channel.name });

      }

      // Suche zurücksetzen
      this.isSearching = false;
      this.isChannelSelect = false;
      this.searchQuery = '';
      this.filteredChannels = [];
    } else {
      console.error("Ungültiger Benutzer:", channel);
    }
  }

  async openChanneFromDirectMessage(channel: Channel, i: number) {
    const currentUser = this.currentUser();
    this.isSearching = false; // Suche beenden
    this.searchQuery = ''; // Suche zurücksetzen
    this.channels = []; // Gefilterte Channels zurücksetzen
    this.channelChatMessage = ''; // Chat-Nachricht zurücksetzen
    this.channelsService.currentChannelId = channel.id;
    this.channelsService.channelIsClicked = true;
    this.channelsService.clickChannelContainer(channel, i);
    this.openChannelEvent.emit();
    this.chatUtilityService.openChannelMessage();
    if (currentUser) {
      this.messageService.loadMessages(currentUser.id, channel.id);
    } else {
      console.error("currentUserUid is null");
    }
    this.channelsService.loadChannels();
  }

  selectUser(user: User) {
    if (user && user.id) {
      // Entferne das letzte '@' und füge den vollständigen Benutzernamen hinzu
      this.channelChatMessage = this.channelChatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.channelChatMessage.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.channelChatMessage = this.channelChatMessage.slice(0, lastAtIndex);
      }

      // Füge den neuen Benutzernamen hinzu
      this.channelChatMessage += ` @${user.name} `;

      // Benutzer zu `markedUser` hinzufügen, falls noch nicht vorhanden
      if (!this.markedUser.some(u => u.id === user.id)) {
        this.markedUser.push({ id: user.id, name: user.name });


      }

      // Suche zurücksetzen
      this.isSearching = false;
      this.isUserSelect = false;
      this.searchQuery = '';
      this.filteredUsers = [];
    } else {
      console.error("Ungültiger Benutzer:", user);
    }
  }


  onSearch(): void {
    // Benutzersuche mit @
    if (this.isUserSelect) {
      this.filteredUsers = this.users.filter(user =>
        user.name.toLowerCase().startsWith(this.searchQuery) ||
        (user.email && user.email.toLowerCase().startsWith(this.searchQuery))
      );
    } else {
      this.filteredUsers = []; // Zurücksetzen, wenn keine Benutzersuche aktiv ist
    }

    // Kanalsuche mit #
    if (!this.isUserSelect) {
      const currentUserId = this.authService.currentUserUid;

      if (currentUserId) {
        this.filteredChannels = this.channels.filter(channel =>
          channel.name.toLowerCase().startsWith(this.searchQuery) && // Fix: searchQueryMessage verwendet
          channel.memberUids && channel.memberUids.includes(currentUserId)   // Benutzer-ID in Mitgliedern prüfen
        );
      } else {
        this.filteredChannels = []; // Keine Kanäle anzeigen, wenn currentUserId nicht verfügbar ist
      }
    } else {
      this.filteredChannels = []; // Zurücksetzen, wenn keine Kanalsuche aktiv ist
    }
  }



  openChannelDescriptionDialog() {
    this.dialog.open(ChannelDescriptionDialogComponent)
  }

  /// Auslagern ???
  showEmoji() {
    this.showEmojiPickerEdit = false; // Blendet den anderen Picker sofort aus
    setTimeout(() => {
      this.showEmojiPicker = !this.showEmojiPicker;
    }, 0);
  }

  showEmojiForEdit() {
    this.showEmojiPicker = false; // Blendet den anderen Picker sofort aus

    // Füge eine Verzögerung hinzu, bevor der aktuelle Picker angezeigt wird
    setTimeout(() => {
      this.showEmojiPickerEdit = !this.showEmojiPickerEdit;
    }, 0);
  }

  showEmojiForReact(message: Message) {
    this.channelsService.preventScroll = true; // Verhindert das Scrollen
    this.showEmojiPicker = false; // Blendet den anderen Picker sofort aus
    this.showEmojiPickerEdit = false;
    this.selectedMessage = message;
    setTimeout(() => {
      this.showEmojiPickerReact = !this.showEmojiPickerReact;
    }, 0);
  }



  addEmoji(event: any) {
    this.channelChatMessage += event.emoji.native;
  }

  addEmojiForEdit(event: any) {
    this.editedMessage += event.emoji.native;
  }

  addOrUpdateReaction(message: any, emoji: string): void {
    const currentUser = this.currentUser();
    if (!currentUser) {
      console.warn('Kein Benutzer gefunden!');
      return;
    }

    const senderID = currentUser.id;
    const senderName = currentUser.name || '';
    const emojiReaction = message.reactions.find(
      (r: EmojiReaction) => r.emoji === emoji);

    // Sicherstellen, dass senderID immer ein string ist
    const safeSenderID = senderID ?? '';  // Fällt auf einen leeren String zurück, wenn senderID null oder undefined ist

    if (emojiReaction) {
      // Sicherstellen, dass senderID immer ein Array von Strings ist, auch wenn es null ist
      const senderIDs = emojiReaction.senderID ? emojiReaction.senderID.split(', ') : [];
      const senderNames = emojiReaction.senderName ? emojiReaction.senderName.split(', ') : [];
      const currentUserIndex = senderIDs.indexOf(safeSenderID);

      if (currentUserIndex > -1) {
        // Reaktion entfernen
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
        // Reaktion hinzufügen
        emojiReaction.count += 1;
        emojiReaction.senderID += (emojiReaction.senderID ? ', ' : '') + safeSenderID;
        emojiReaction.senderName += (emojiReaction.senderName ? ', ' : '') + senderName;
      }
    } else {
      // Neue Reaktion hinzufügen
      message.reactions.push({
        emoji: emoji,
        senderID: safeSenderID,
        senderName: senderName,
        count: 1
      });
    }

    this.updateMessageReactions(message); // Aktualisiere die Reaktionen in Firestore
  }


  async updateMessageReactions(message: any): Promise<void> {
    const messageDocRef = doc(this.firestore, `messages/${message.messageId}`);
    updateDoc(messageDocRef, { reactions: message.reactions })
      .then(() => {
        this.cd.markForCheck(); // Komponenten-Update anstoßen
      })
      .catch(error => {
        console.error('Fehler beim Aktualisieren der Reaktionen: ', error);
      });
  }

  addEmojiForReact(event: any): void {
    const emoji = event.emoji.native; // Emoji aus dem Event extrahieren
    if (this.selectedMessage) {
      this.addOrUpdateReaction(this.selectedMessage, emoji); // Nutzung der bestehenden Funktion zum Hinzufügen oder Aktualisieren von Reaktionen
      this.showEmojiPickerReact = false; // Emoji-Picker schließen, falls er geöffnet ist
    }
  }


  toggleEmojiPicker() {
    this.messageService.toggleEmojiPicker();
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (this.showEmojiPicker && !target.closest('emoji-mart') && !target.closest('.message-icon')) {
      this.showEmojiPicker = false;
    }
    if (this.showEmojiPickerEdit && !target.closest('emoji-mart') && !target.closest('.message-icon')) {
      this.showEmojiPickerEdit = false;
    }
    if (this.showEmojiPickerReact && !target.closest('emoji-mart') && !target.closest('.message-icon')) {
      this.showEmojiPickerReact = false;
    }
  }

  // --------------------------


  showMessageEditToggle() {
    this.showMessageEdit = !this.showMessageEdit;
  }

  closeEditMessageBox() {
    this.channelsService.preventScroll = true; // Erlaube das Scrollen wieder
    this.showMessageEdit = false;
  }

  editMessage(docId: string, messageText: string | null) {
    this.editingMessageId = docId; // Verwende die Dokument-ID
    this.editedMessage = messageText || '';
    this.showMessageEditArea = true;
    this.showMessageEdit = false;
  }


  saveMessage(message: Message) {
    if (this.editingMessageId) { // Nutze die `editingMessageId` (Dokument-ID) anstelle von `message.messageId`
      const messageRef = doc(this.firestore, `messages/${this.editingMessageId}`); // Verweise auf die Dokument-ID

      updateDoc(messageRef, { message: this.editedMessage }).then(() => {
        this.editingMessageId = null;
        this.showMessageEditArea = false;
      }).catch(error => {
        console.error("Fehler beim Speichern der Nachricht: ", error);
      });
    }
  }

  cancelMessageEdit() {
    this.editingMessageId = null;
    this.editedMessage = '';
    this.showMessageEditArea = false;
  }

  isEditing(docId: string): boolean {
    return this.editingMessageId === docId; // Prüfe gegen die Firestore-Dokument-ID
  }

  async showThread(message: Message) {
    this.messageService.selectedMessage = message;
    for (const answer of message.answers) {
      answer.isOwnMessage = (answer.senderID === this.authService.currentUserUid);
      answer.displayDate = this.messageService.formatTimestamp(answer.timestamp.toDate());
      answer.formattedTimestamp = answer.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      answer.senderAvatar = await this.userService.getSelectedUserAvatar(answer.senderID!);
    }

    this.selectedMessage = message;
    this.showThreadEvent.emit(message); // Emit the updated message
  }


  showError() {
    console.error("Kein Kanal ausgewählt.");
  }

  async sendMessage() {
    if (!this.channelsService.currentChannelId) {
      this.showError(); // Fehler, wenn kein Kanal ausgewählt ist
      return;
    }

    if (this.channelChatMessage.trim()) {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        const messagesRef = collection(this.firestore, 'messages');

        const markedUserDetails = this.markedUser.map(user => ({
          id: user.id,
          name: user.name,
        }));

        const newMessage: Message = new Message({
          senderID: this.currentUser()?.id,
          senderName: this.currentUser()?.name,
          message: this.channelChatMessage,
          channelId: this.channelsService.currentChannelId, // Verwende die gespeicherte channelId
          reactions: [],
          answers: [],
          markedUser: markedUserDetails || [],
        });

        const messageDocRef = await addDoc(messagesRef, {
          senderID: newMessage.senderID,
          senderName: newMessage.senderName,
          message: newMessage.message,
          channelId: newMessage.channelId,
          reaction: newMessage.reactions,
          answers: newMessage.answers,
          timestamp: new Date(),
          markedUser: newMessage.markedUser,
        });

        this.channelChatMessage = ''; // Eingabefeld leeren
        this.messageService.loadMessages(this.authService.currentUser()?.id, this.channelsService.currentChannelId);
        // Übergebe die channelId
        // this.scrollToBottom();
      } else {
        console.error('Kein Benutzer angemeldet');
      }
    }
  }

  formatSenderNames(senderNames: string, senderIDs: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    const currentUserID = this.currentUser()?.id;
    const formattedNames = senderNameList.map((name, index) => {
      return senderIDList[index] === currentUserID ? 'Du' : name;
    });

    if (formattedNames.length > 2) {
      const otherCount = formattedNames.length - 1;
      return `Du und ${otherCount} weitere Personen`;
    } else if (formattedNames.length === 3) {
      return `${formattedNames[0]}, ${formattedNames[1]} und ${formattedNames[2]}`;
    } else if (formattedNames.length === 2) {
      return `${formattedNames[0]} und ${formattedNames[1]}`;
    }
    return formattedNames[0];
  }


  getReactionVerb(senderNames: string, senderIDs: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    const currentUserID = this.currentUser()?.id;
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
}