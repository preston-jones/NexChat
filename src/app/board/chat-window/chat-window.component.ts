import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { User } from '../../shared/models/user.class';
import { Channel } from '../../shared/models/channel.class';
import { collection, Firestore, onSnapshot, orderBy, query, } from '@angular/fire/firestore';
import { Auth, } from '@angular/fire/auth';
import { UserService } from '../../shared/services/firestore/user-service/user.service';
import { AuthService } from '../../shared/services/authentication/auth-service/auth.service';
import { UploadFileService } from '../../shared/services/firestore/storage-service/upload-file.service';
import { ChannelsService } from '../../shared/services/channels/channels.service';
import { MatDialog } from '@angular/material/dialog';
import { MessagesService } from '../../shared/services/messages/messages.service';
import { SendMessageService } from '../../shared/services/messages/send-message.service';
import { MatSnackBar } from '@angular/material/snack-bar';



@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, FormsModule,
    MatFormFieldModule, MatInputModule, CommonModule, PickerComponent, NgIf, NgFor],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
})

export class ChatWindowComponent implements OnInit {
  messages = this.messageService.messages;
  usersOriginal: User[] = [];
  channelsOriginal: Channel[] = [];
  users: User[] = [];
  channels: Channel[] = [];
  currentUser = this.authService.getUserSignal();
  currentUserId = this.authService.currentUserUid;
  showEmojiPicker = false;
  chatMessage = '';
  markedUser: { id: string; name: string }[] = [];
  currentUserUid = '';
  senderAvatar: string | null = null;
  senderName: string | null = null;
  selectedFile = this.sendMessageService.selectedFile; // Service für den Datei-Upload
  filePreviewUrl: string | null = null;
  searchQuery: string = '';
  isSearching: boolean = false;
  searchQueryMessage: string = '';
  isSearchingMessage: boolean = false;
  isUserSelect: boolean = false;
  isChannelSelect: boolean = false;
  filteredUsers: User[] = [];
  filteredChannels: Channel[] = [];
  selectedUser = this.userService.selectedUser;
  selectedUserMessage = '';
  selectedChannel = this.channelsService.currentChannelId;
  messageId: string | null = null;
  markedChannel: { id: string; name: string }[] = [];


  @Output() openDirectMessageEvent = new EventEmitter<void>();
  @Output() openChannelMessageEvent = new EventEmitter<void>();
  @Output() openDirectMessageFromChatEvent = new EventEmitter<{ selectedUser: User, index: number }>();
  @Output() openChannelMessageFromChatEvent = new EventEmitter<{ selectedChannel: Channel, index: number }>();
  @ViewChild('chatWindow') private chatWindow!: ElementRef;
  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private userService: UserService,
    public cd: ChangeDetectorRef,
    private authService: AuthService,
    private uploadFileService: UploadFileService,
    public channelsService: ChannelsService,
    public dialog: MatDialog,
    public messageService: MessagesService,
    public sendMessageService: SendMessageService,
    private snackBar: MatSnackBar,) { }

  ngOnInit() {
    this.loadData();
  }

  async onSearch(event: any) {
    this.searchQuery = event.target.value.trim().toLowerCase();
    this.isSearching = this.searchQuery.trim().length > 0;

    // Setze die Benutzer- und Kanallisten vor der Filterung zurück
    this.users = [...this.usersOriginal];
    this.channels = [...this.channelsOriginal];

    // Leere Ergebnisse, falls die Eingabe nicht passt
    if (this.searchQuery) {
      if (this.searchQuery.startsWith('#')) {
        const currentUserId = this.authService.currentUserUid || ''; // Fallback zu leerem String
        this.channels = this.channels.filter(channel =>
          channel.name.toLowerCase().startsWith(this.searchQuery.slice(1)) &&
          channel.memberUids &&
          channel.memberUids.includes(currentUserId)
        );

        this.users = []; // User-Suchergebnisse leeren
      } else if (this.searchQuery.startsWith('@') || this.isValidEmail(this.searchQuery)) {
        // Suche nach Usern (nach @ oder E-Mail-Adresse)
        this.users = this.users.filter(user =>
          user.name.toLowerCase().startsWith(this.searchQuery.slice(1)) || // startsWith anstelle von includes
          (user.email && user.email.toLowerCase().startsWith(this.searchQuery)) // Null-Prüfung für user.email
        );
        this.channels = []; // Channel-Suchergebnisse leeren
      } else {
        // Suche nach Benutzern, falls keine spezifische Suche
        this.users = this.users.filter(user =>
          user.name.toLowerCase().startsWith(this.searchQuery) || // startsWith anstelle von includes
          (user.email && user.email.toLowerCase().startsWith(this.searchQuery)) // Null-Prüfung für user.email
        );

        // Keine Kanalsuche, wenn die Eingabe keine # ist
        this.channels = [];
      }
    } else {
      // Leere Ergebnisse, falls die Eingabe nicht passt
      this.channels = [];
      this.users = [];
      await this.loadUsers(); // Lade die Benutzerliste neu
      await this.loadChannels(); // Lade die Kanalliste neu
    }
  }

  isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }


  async loadData() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.loadUsers(); // Warten auf das Laden der Benutzer
        this.usersOriginal = [...this.users]; // Kopiere die ursprüngliche Benutzerliste
        await this.loadChannels();
        this.channelsOriginal = [...this.channels];
      } else {
        console.log('Kein Benutzer angemeldet');
      }
    });
    this.cd.detectChanges();
  }


  async loadUsers() {
    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef, orderBy('name'));

    return new Promise((resolve) => {
      onSnapshot(usersQuery, async (snapshot) => {
        this.users = await Promise.all(snapshot.docs.map(async (doc) => {
          const userData = doc.data() as User;
          return { ...userData, id: doc.id };
        }));
        this.cd.detectChanges();
        resolve(this.users); // Promise auflösen
      });
    });
  }


  async loadChannels() {
    let channelRef = collection(this.firestore, 'channels');
    let channelQuery = query(channelRef, orderBy('name'));

    return new Promise((resolve) => {
      onSnapshot(channelQuery, async (snapshot) => {
        this.channels = await Promise.all(snapshot.docs.map(async (doc) => {
          const channelData = doc.data() as Channel;
          return { ...channelData, id: doc.id };
        }));
        this.cd.detectChanges();
        resolve(this.channels); // Promise auflösen
      });
    });
  }

  selectChannel(channel: { name: string; id: string }) {
    this.searchQuery = `#${channel.name}`; // Channel-Namen mit # voranstellen
    this.sendMessageService.chatMessage = ''; // Chat-Nachricht zurücksetzen
    this.isSearching = false; // Suche beenden
    this.isSearchingMessage = false;
    this.channels = []; // Gefilterte Channels zurücksetzen
    this.channelsService.currentChannelId = channel.id; // Channel-ID setzen;
  }

  selectUser(user: User) {
    this.searchQuery = "@"; // Benutzername mit @ voranstellen
    this.chatMessage = ''; // Chat-Nachricht zurücksetzen

    if (user && user.id) {
      this.isSearching = false; // Suche beenden
      this.isSearchingMessage = false;
      this.sendMessageService.chatMessage = '';
      this.isUserSelect = false; // Benutzer suchen
      this.users = []; // Gefilterte Benutzer zurücksetzen
      this.selectedUser = user; // Benutzer setzen
      this.sendMessageService.selectedUser = this.selectedUser; // Korrekte Bindung verwenden

    } else {
      console.error("Ungültiger Benutzer:", user); // Fehler protokollieren
    }
  }

  removeSelectedUser() {
    this.selectedUser = null;
    this.sendMessageService.selectedUser = null;
    this.searchQuery = '';
    this.isSearching = false;

    // Zeige eine Snackbar als Rückmeldung
    this.snackBar.open('Benutzer entfernt', 'Schließen', {
      duration: 2000, // 2 Sekunden anzeigen
      panelClass: ['custom-snackbar'],
    });
  }

  selectChannelMessage(channel: Channel) {
    if (channel && channel.id) {
      // Entferne das letzte '@' und füge den vollständigen Benutzernamen hinzu
      this.chatMessage = this.chatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.chatMessage.lastIndexOf('#');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.chatMessage = this.chatMessage.slice(0, lastAtIndex);
      }

      this.sendMessageService.chatMessage += ` ${channel.name} `;

      if (!this.markedChannel.some(c => c.id === channel.id)) {
        this.markedChannel.push({ id: channel.id, name: channel.name });

      }

      // Suche zurücksetzen
      this.isSearching = false;
      this.isChannelSelect = false;
      this.isSearchingMessage = false;
      this.searchQuery = '';
      this.filteredChannels = [];
    } else {
      console.error("Ungültiger Benutzer:", channel);
    }
  }

  selectUserMessage(user: User) {
    if (user && user.id) {
      // Entferne das letzte '@' und füge den vollständigen Benutzernamen hinzu
      this.chatMessage = this.chatMessage.trim(); // Leerzeichen am Ende entfernen
      const lastAtIndex = this.chatMessage.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Entferne den '@' und alles dahinter (einschließlich des letzten Benutzernamens)
        this.chatMessage = this.chatMessage.slice(0, lastAtIndex);
      }

      // Füge den neuen Benutzernamen hinzu
      this.sendMessageService.chatMessage += ` ${user.name} `;

      // Benutzer zu `markedUser` hinzufügen, falls noch nicht vorhanden
      if (!this.markedUser.some(u => u.id === user.id)) {
        this.markedUser.push({ id: user.id, name: user.name });

      }

      // Suche zurücksetzen
      this.isSearching = false;
      this.isUserSelect = false;
      this.isSearchingMessage = false;
      this.searchQuery = '';
      this.filteredUsers = [];
    } else {
      console.error("Ungültiger Benutzer:", user);
    }
  }

  toggleSearch(): void {
    this.isUserSelect = !this.isUserSelect; // Suchstatus umschalten
    if (this.isUserSelect) {
      this.onSearchMessageArea();
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
      this.searchQueryMessage = fullText.slice(lastAtIndex + 1).trim().toLowerCase();
      this.isChannelSelect = false;
      this.isUserSelect = true; // Benutzer suchen
      this.isSearchingMessage = true;
      this.onSearchMessageArea();
    } else if (lastHashIndex !== -1) {
      // Suche nach Kanälen mit #
      this.searchQueryMessage = fullText.slice(lastHashIndex + 1).trim().toLowerCase();
      this.isUserSelect = false; // Kanäle suchen
      this.isChannelSelect = true;
      this.isSearchingMessage = true;
      this.onSearchMessageArea();
    } else {
      // Keine Suche aktiv, Liste zurücksetzen
      this.searchQueryMessage = '';
      this.isSearchingMessage = false;
      this.filteredUsers = [];
      this.filteredChannels = [];
    }
  }

  async onSearchMessageArea() {
    await this.loadUsers(); // Benutzerliste neu laden
    await this.loadChannels(); // Kanalliste neu laden

    // Benutzersuche mit @
    if (this.isUserSelect) {
      this.filteredUsers = this.users.filter(user =>
        user.name.toLowerCase().startsWith(this.searchQueryMessage) ||
        (user.email && user.email.toLowerCase().startsWith(this.searchQueryMessage))
      );
    } else {
      this.filteredUsers = []; // Zurücksetzen, wenn keine Benutzersuche aktiv ist
    }

    // Kanalsuche mit #
    if (!this.isUserSelect) {
      const currentUserId = this.authService.currentUserUid;

      if (currentUserId) {
        this.filteredChannels = this.channels.filter(channel =>
          channel.name.toLowerCase().startsWith(this.searchQueryMessage) && // Fix: searchQueryMessage verwendet
          channel.memberUids && channel.memberUids.includes(currentUserId)   // Benutzer-ID in Mitgliedern prüfen
        );
      } else {
        this.filteredChannels = []; // Keine Kanäle anzeigen, wenn currentUserId nicht verfügbar ist
      }
    } else {
      this.filteredChannels = []; // Zurücksetzen, wenn keine Kanalsuche aktiv ist
    }
  }
}