import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgModule, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, onSnapshot, orderBy, query, updateDoc, where } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { ChannelsService } from '../../../shared/services/channels/channels.service';
import { MessagesService } from '../../../shared/services/messages/messages.service';
import { UploadFileService } from '../../../shared/services/firestore/storage-service/upload-file.service';
import { NoteService } from '../../../shared/services/notes/notes.service';
import { AuthService } from '../../../shared/services/authentication/auth-service/auth.service';
import { UserService } from '../../../shared/services/firestore/user-service/user.service';
import { User } from '../../../shared/models/user.class';
import { Channel } from '../../../shared/models/channel.class';
import { Message } from '../../../shared/models/message.class';
import { DirectMessage } from '../../../shared/models/direct.message.class';
import { ChatUtilityService } from '../../../shared/services/messages/chat-utility.service';
import { v4 as uuidv4 } from 'uuid';
import { EmojiReaction } from '../../../shared/models/emoji-reaction.model';
import { ChannelNavigationService } from '../../../shared/services/chat/channel-navigation.service';
import { DirectMessagesService } from '../../../shared/services/messages/direct-messages.service';
import { Note } from '../../../shared/models/note.class';



@Component({
  selector: 'app-direct-message',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, FormsModule,
    MatFormFieldModule, MatInputModule, CommonModule, PickerComponent, NgIf, NgFor,],
  templateUrl: './direct-message.component.html',
  styleUrls: ['./direct-message.component.scss',
    '../../../../styles.scss',
    '../../../shared/styles/message-editor.scss',
    '../../../shared/styles/message-textfield.scss',
    '../../../shared/styles/chat-window.scss'
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,


})
export class DirectMessageComponent implements OnInit, AfterViewInit {
  message: DirectMessage[] = [];
  selectedMessage: DirectMessage | null = null;
  users: User[] = [];
  filteredUsers: User[] = [];
  filteredChannels: Channel[] = [];
  channels: Channel[] = [];
  currentUser: User | null | undefined = null;
  showEmojiPicker = false;
  showEmojiPickerEdit: boolean = false;
  showEmojiPickerReact: boolean = false;
  channelChatMessage = '';
  directChatMessage = '';
  messageArea = true;
  senderAvatar: string | null = null;
  senderName: string | null = null;
  selectedFile: File | null = null;// Service für den Datei-Upload
  filePreviewUrl: string | null = null;
  messageId: string | null = null;
  searchQuery: string = '';
  isSearching: boolean = false;
  isUserSelect: boolean = false;
  isChannelSelect: boolean = false;
  markedUser: { id: string; name: string }[] = [];
  markedChannel: { id: string; name: string }[] = [];

  @Output() openChannelEvent = new EventEmitter<void>();
  @Input() selectedUser = this.chatUtilityService.directMessageUser;
  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild('directChatMessageTextarea', { static: false }) directChatMessageTextarea!: ElementRef<HTMLTextAreaElement>;

  private isViewInitialized = false;

  constructor(
    public userService: UserService,
    private firestore: Firestore,
    private auth: Auth,
    private cd: ChangeDetectorRef,
    public authService: AuthService,
    private uploadFileService: UploadFileService,
    public channelsService: ChannelsService,
    public dialog: MatDialog,
    public messagesService: MessagesService,
    private chatUtilityService: ChatUtilityService,
    private channelNavigationService: ChannelNavigationService,
    public noteService: NoteService,
    public directMessageService: DirectMessagesService
  ) { }

  ngOnInit() {
    this.directMessageService.clearAndFocusTextarea.subscribe(() => {
      this.clearAndFocusTextarea();
    });


    this.chatUtilityService.messageId$.subscribe(id => {
      this.messageId = id;
    });

    this.loadData();
    this.currentUser = this.authService.currentUser();

    setTimeout(() => {
      this.scrollToBottom();
      console.log('Scroll to bottom triggered', this.chatWindow.nativeElement.scrollTop);
    }, 0);
  }


  ngAfterViewInit() {
    console.log('chatWindow:', this.chatWindow);
    this.isViewInitialized = true;
    this.clearAndFocusTextarea();

    const observer = new MutationObserver(() => {
      console.log('MutationObserver triggered');
      if (!this.directMessageService.preventScroll) {
        this.scrollToBottom();
      }
    });
    observer.observe(this.chatWindow.nativeElement, { childList: true, subtree: true });
  }


  scrollToBottom() {
    if (this.directMessageService.preventScroll) {
      this.directMessageService.preventScroll = false; // Reset the flag
      return; // Prevent scrolling
    }
    if (this.chatWindow && this.chatWindow.nativeElement) {
      this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
    }
  }

  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.loadUsers();
        await this.loadChannels();
      } else {
        console.log('Kein Benutzer angemeldet');
      }
    });
  }


  async loadUsers() {
    let usersRef = collection(this.firestore, 'users');
    let usersQuery = query(usersRef, orderBy('name'));

    onSnapshot(usersQuery, async (snapshot) => {
      this.users = await Promise.all(snapshot.docs.map(async (doc) => {
        let userData = doc.data() as User;
        return { ...userData, id: doc.id };
      }));
    });
  }

  async loadChannels() {
    let channelsRef = collection(this.firestore, 'channels');
    let channelsQuery = query(channelsRef, orderBy('name'));

    onSnapshot(channelsQuery, async (snapshot) => {
      this.channels = await Promise.all(snapshot.docs.map(async (doc) => {
        let channelsData = doc.data() as Channel;
        return { ...channelsData, id: doc.id };
      }));
    });
  }

  // Suche umschalten
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
      this.directChatMessage = this.directChatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.directChatMessage.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.directChatMessage = this.directChatMessage.slice(0, lastAtIndex);
      }

      this.directChatMessage += ` ${channel.name} `;

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

  selectUser(user: User) {
    if (user && user.id) {
      // Entferne das letzte '@' und füge den vollständigen Benutzernamen hinzu
      this.directChatMessage = this.directChatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.directChatMessage.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.directChatMessage = this.directChatMessage.slice(0, lastAtIndex);
      }

      // Füge den neuen Benutzernamen hinzu
      this.directChatMessage += ` @${user.name} `;

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
      const currentUserId = this.currentUser?.id || '';
      this.filteredChannels = this.channels.filter(channel =>
        channel.name.toLowerCase().startsWith(this.searchQuery.slice(1)) &&
        channel.memberUids &&
        channel.memberUids.includes(currentUserId)
      );

    } else {
      this.filteredChannels = []; // Zurücksetzen, wenn keine Kanalsuche aktiv ist
    }
  }

  showEmoji() {
    this.showEmojiPickerEdit = false; // Blendet den anderen Picker sofort aus
    setTimeout(() => {
      this.showEmojiPicker = !this.showEmojiPicker;
    }, 0);
  }

  showEmojiForEdit() {
    this.showEmojiPicker = false; // Blendet den anderen Picker sofort aus
    setTimeout(() => {
      this.showEmojiPickerEdit = !this.showEmojiPickerEdit;
    }, 0);
  }

  showEmojiForReact(message: any): void {
    this.directMessageService.preventScroll = true; // Verhindert das Scrollen, wenn der Emoji-Picker geöffnet ist
    this.showEmojiPicker = false;  // Deaktiviere den Emoji-Picker, falls er sichtbar ist
    this.showEmojiPickerEdit = false; // Deaktiviere den Bearbeitungsmodus des Emoji-Pickers
    this.messageId = message.messageId;
    this.selectedMessage = message;
    setTimeout(() => {
      this.showEmojiPickerReact = !this.showEmojiPickerReact;
    }, 0);
  }


  addEmoji(event: any) {
    this.directChatMessage += event.emoji.native;
  }

  addEmojiForEdit(event: any) {
    this.directMessageService.editedMessage += event.emoji.native;
  }


  addOrUpdateReaction(message: any, emoji: string): void {
    const currentUser = this.currentUser;
    if (!currentUser) {
      console.warn('Kein Benutzer gefunden!');
      return;
    }

    this.messageId = message.messageId;
    this.selectedMessage = message;
    const senderID = currentUser.id ?? '';
    const senderName = currentUser.name || '';
    const safeSenderID = senderID ?? '';
    const emojiReaction = this.selectedMessage?.reactions.find(
      (r: EmojiReaction) => r.emoji === emoji
    );


    // Überprüfe, ob `reactions` ein Array ist
    if (!Array.isArray(this.selectedMessage?.reactions)) {
      console.warn('Reactions sind nicht korrekt formatiert! Initialisiere als leeres Array.');
      this.selectedMessage!.reactions = [];
    }


    if (emojiReaction) {
      // Überprüfe, ob der Benutzer bereits reagiert hat
      const senderIDs = emojiReaction.senderID ? emojiReaction.senderID.split(', ') : [];
      const senderNames = emojiReaction.senderName ? emojiReaction.senderName.split(', ') : [];
      const currentUserIndex = senderIDs.indexOf(safeSenderID);

      if (currentUserIndex > -1) {
        // Reaktion entfernen
        senderIDs.splice(currentUserIndex, 1);
        senderNames.splice(currentUserIndex, 1);
        emojiReaction.count -= 1;

        if (emojiReaction.count === 0) {
          const emojiIndex = this.selectedMessage!.reactions.indexOf(emojiReaction);
          this.selectedMessage!.reactions.splice(emojiIndex, 1);
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
      // Neue Reaktion hinzufügen, wenn sie noch nicht existiert
      this.selectedMessage!.reactions.push({
        emoji: emoji,
        senderID: senderID,
        senderName: senderName,
        count: 1
      });
    }
    // Aktualisierung der Reaktionen für die spezifische Nachricht in Firestore
    this.updateMessageReactions(message);
  }


  async updateMessageReactions(message: any): Promise<void> {
    if (message.messageId) {
      const messageDocRef = doc(this.firestore, `direct_messages/${message.messageId}`);
      updateDoc(messageDocRef, { reactions: message.reactions })
      .then(() => {
        this.cd.markForCheck(); // Komponenten-Update anstoßen
      });
    }
    else if (message.noteId) {
      const messageDocRef = doc(this.firestore, `notes/${message.noteId}`);
      updateDoc(messageDocRef, { reactions: message.reactions })
      .then(() => {
        this.cd.markForCheck(); // Komponenten-Update anstoßen
      });
    }
  }



  addEmojiForReact(event: any): void {
    const emoji = event.emoji.native; // Emoji aus dem Event extrahieren
    if (this.selectedMessage) {
      this.addOrUpdateReaction(this.selectedMessage, emoji); // Nutzung der bestehenden Funktion zum Hinzufügen oder Aktualisieren von Reaktionen
      this.showEmojiPickerReact = false; // Emoji-Picker schließen, falls er geöffnet ist
    }
  }


  toggleEmojiPicker() {
    this.messagesService.toggleEmojiPicker();
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


  formatSenderNames(senderNames: string, senderIDs: string): string {
    const senderIDList = senderIDs.split(', ');
    const senderNameList = senderNames.split(', ');
    const currentUserID = this.currentUser?.id;
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
    const currentUserID = this.currentUser?.id;
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

  showMessageEditToggle() {
    this.directMessageService.preventScroll = true;
    this.directMessageService.showMessageEdit = !this.directMessageService.showMessageEdit;
  }

  closeEditMessageBox() {
    this.directMessageService.showMessageEdit = false;
  }



  editMessage(messageId: string, messageText: string | null) {
    this.directMessageService.editingMessageId = messageId;
    this.directMessageService.editedMessage = messageText || '';
    this.directMessageService.showMessageEditArea = true;         // Bearbeitungsbereich anzeigen
    this.directMessageService.showMessageEdit = false;            // Toggle zurücksetzen
  }


  saveEditedMessage(message: any) {
    if (message.messageId) {
      this.directMessageService.saveMessage(message, this.directMessageService.editingMessageId!, this.directMessageService.editedMessage);
    }
    else if (message.noteId) {
      this.noteService.saveNote(message, this.directMessageService.editingMessageId!, this.directMessageService.editedMessage);
    }
    this.directMessageService.editingMessageId = null;
    this.directMessageService.showMessageEditArea = false;
  }


  closeMessageEdit() {
    this.directMessageService.editingMessageId = null;
    this.messageId = '';
    this.directMessageService.editedMessage = '';
    this.directMessageService.showMessageEditArea = false;
  }

  
  isEditing(messageId: string): boolean {
    return this.directMessageService.editingMessageId === messageId; // Prüfe gegen die Firestore-Dokument-ID
  }


  showError() {
    console.error("Kein Kanal ausgewählt.");
  }


  async sendMessage() { 
    if (this.directChatMessage.length > 0) {
      this.directChatMessage.trim();
      if (this.currentUser?.id === this.userService.selectedUser?.id) {
        await this.noteService.createNewNote(this.directChatMessage, this.currentUser!, this.markedUser);
        this.clearInputField();
        this.clearUploadCache();
        this.markedUser = [];
      }
      else {
        await this.directMessageService.createNewMessage(this.directChatMessage, this.currentUser!, this.markedUser);
        this.clearInputField();
        this.clearUploadCache();
        this.markedUser = [];
      }
    }
  }


  async updateMessageFileURL(messageDocRef: any) {
    if (this.selectedFile) {
      await updateDoc(messageDocRef, {
        fileURL: await this.uploadFileService.uploadFileWithIdsDirectMessages(this.selectedFile, messageDocRef.id),
      });
    }
  }


  clearInputField() {
    this.directChatMessage = '';
  }


  clearAndFocusTextarea() {
    if (this.isViewInitialized && this.directChatMessageTextarea && this.directChatMessageTextarea.nativeElement) {
      this.directChatMessage = ''; // Clear the input field
      this.directChatMessageTextarea.nativeElement.focus(); // Set focus on the input field
    } else {
      console.warn('directChatMessageTextarea is not initialized or view is not ready.');
    }
  }


  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (file) {
      this.selectedFile = file; // Speichere die ausgewählte Datei

      // Datei als base64 speichern, um sie im localStorage zu speichern
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = reader.result as string;
        this.filePreviewUrl = fileData; // Speichere die Vorschau-URL für die Datei
        localStorage.setItem('selectedFile', JSON.stringify({ fileName: file.name, fileData }));
        console.log('File saved to localStorage');
      };
      reader.readAsDataURL(file);
    } else {
      console.error('No file selected');
    }
  }

  clearUploadCache() {
    this.selectedFile = null;
    this.filePreviewUrl = null;
    localStorage.removeItem('selectedFile');
  }

  // Trigger für verstecktes File-Input
  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  isImageFile(fileURL: string | null): boolean {
    if (!fileURL) return false;

    // Extrahiere die Datei-Informationen aus der Firebase-URL und prüfe den Dateinamen
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
    const url = new URL(fileURL);
    const fileName = url.pathname.split('/').pop(); // Hole den Dateinamen aus dem Pfad

    if (!fileName) return false;

    // Prüfe, ob der Dateiname mit einem der Bildformate endet
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(fileExtension || '');
  }

  getFileNameFromURL(url: string | null): string {
    if (!url) {
      return 'Datei'; // Fallback, falls die URL null ist
    }

    const decodedUrl = decodeURIComponent(url);
    const fileName = decodedUrl.split('?')[0].split('/').pop();
    return fileName || 'Datei'; // Wenn kein Dateiname gefunden wird, 'Datei' als Fallback anzeigen
  }
}