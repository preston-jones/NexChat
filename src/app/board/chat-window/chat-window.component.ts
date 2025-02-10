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


  // showEmoji() {
  //   this.messageService.showEmoji();
  // }

  // addEmoji(event: any) {
  //   this.messageService.addEmoji(event);
  // }

  // toggleEmojiPicker() {
  //   this.messageService.toggleEmojiPicker();
  // }

  // @HostListener('document:click', ['$event'])
  // clickOutside(event: Event) {
  //   const target = event.target as HTMLElement;

  //   if (this.messageService.showEmojiPicker && !target.closest('emoji-mart') && !target.closest('.message-icon')) {
  //     this.messageService.showEmojiPicker = false;
  //   }
  // }

  // showError() {
  //   console.error("Kein Kanal ausgewählt.");
  // }

  // async checkExistingConversation(receiverId: string): Promise<string | null> {
  //   const currentUser = this.authService.currentUser;
  //   if (!currentUser) {
  //     console.error("Kein Benutzer angemeldet.");
  //     return null;
  //   }

  //   const senderId = currentUser()?.id; // aktuelle Benutzer-ID

  //   const messagesRef = collection(this.firestore, 'direct_messages');

  //   // Suche nach einer bestehenden Konversation zwischen dem aktuellen Benutzer und dem Empfänger
  //   const q = query(
  //     messagesRef,
  //     where('senderId', 'in', [senderId, receiverId]),
  //     where('receiverId', 'in', [senderId, receiverId])
  //   );

  //   const querySnapshot = await getDocs(q);

  //   if (!querySnapshot.empty) {
  //     const messageDoc = querySnapshot.docs[0];
  //     return messageDoc.id; // Gibt die messageId der ersten gefundenen Konversation zurück
  //   }

  //   return null; // Keine bestehende Konversation gefunden
  // }

  // async sendMessage() {
  //   if (this.chatMessage.trim() || this.selectedFile) {
  //     const currentUser = this.authService.currentUser;

  //     if (currentUser()) {
  //       // console.log("Aktueller Benutzer:", currentUser()); // Überprüfen, ob der aktuelle Benutzer korrekt abgerufen wird

  //       // Überprüfe, ob ein Benutzer oder ein Kanal ausgewählt ist
  //       if (this.selectedUser?.id) {
  //         console.log("DirectMessageUser:", this.selectedUser.id); // Überprüfen, ob der Benutzer korrekt gesetzt ist
  //         this.messageId = await this.checkExistingConversation(this.selectedUser.id);

  //         // An einen Benutzer senden
  //         const messagesRef = collection(this.firestore, 'direct_messages');

  //         if (this.messageId) {
  //           // Konversation existiert, also aktualisiere sie
  //           const messageDocRef = doc(messagesRef, this.messageId);

  //           // Füge die neue Nachricht zur bestehenden Konversation hinzu
  //           await updateDoc(messageDocRef, {
  //             conversation: arrayUnion({
  //               senderName: currentUser()?.name,
  //               message: this.chatMessage,
  //               reaction: [],
  //               timestamp: new Date(),
  //               receiverName: this.selectedUser?.name, // Zugriff auf den Namen des ausgewählten Benutzers
  //               senderId: currentUser()?.id,
  //               receiverId: this.selectedUser?.id, // Zugriff auf die ID des ausgewählten Benutzers
  //             })
  //           });

  //           // Datei verarbeiten, falls vorhanden
  //           if (this.selectedFile && this.currentUserUid) {
  //             try {
  //               const fileURL = await this.uploadFileService.uploadFileWithIds(this.selectedFile, this.currentUserUid, messageDocRef.id);
  //               await updateDoc(messageDocRef, { fileURL });
  //             } catch (error) {
  //               console.error('Datei-Upload fehlgeschlagen:', error);
  //             }
  //           }
  //         } else {
  //           // Es gibt keine Konversation, also erstelle eine neue
  //           const newMessage: DirectMessage = new DirectMessage({
  //             conversation: [],
  //             senderId: currentUser()?.id,
  //             senderName: currentUser()?.name,
  //             message: this.chatMessage,
  //             reactions: [],
  //             fileURL: '',
  //             receiverId: this.selectedUser?.id, // Zugriff auf die ID des ausgewählten Benutzers
  //             receiverName: this.selectedUser?.name, // Zugriff auf den Namen des ausgewählten Benutzers
  //           });

  //           // Füge die neue Konversation in Firestore hinzu
  //           const messageDocRef = await addDoc(messagesRef, {
  //             senderId: newMessage.senderId,
  //             receiverId: newMessage.receiverId,
  //             timestamp: new Date(),
  //             conversation: [{
  //               senderName: newMessage.senderName,
  //               message: newMessage.message,
  //               reaction: newMessage.reactions,
  //               timestamp: new Date(),
  //               receiverName: newMessage.receiverName,
  //               senderId: newMessage.senderId,
  //               receiverId: newMessage.receiverId,
  //             }]
  //           });

  //           // Datei verarbeiten, falls vorhanden
  //           if (this.selectedFile && this.currentUserUid) {
  //             try {
  //               const fileURL = await this.uploadFileService.uploadFileWithIds(this.selectedFile, this.currentUserUid, messageDocRef.id);
  //               newMessage.fileURL = fileURL;
  //               await updateDoc(messageDocRef, { fileURL: newMessage.fileURL });
  //             } catch (error) {
  //               console.error('Datei-Upload fehlgeschlagen:', error);
  //             }
  //           }
  //         }
  //         const userIndex = this.users.findIndex(user => user.id === this.selectedUser?.id); // Find the index of the selected user
  //         if (userIndex !== -1) {
  //           this.openDirectMessageFromChatEvent.emit({ selectedUser: this.selectedUser, index: userIndex });
  //         } else {
  //           console.error("Selected user not found in users array");
  //         }

  //       } else if (this.channelsService.currentChannelId) {
  //         // An einen Kanal senden
  //         const messagesRef = collection(this.firestore, 'messages');

  //         const newMessage: Message = new Message({
  //           senderID: currentUser()?.id,
  //           senderName: currentUser()?.name,
  //           message: this.chatMessage,
  //           channelId: this.channelsService.currentChannelId,
  //           reactions: [],
  //           answers: [],
  //           fileURL: '',
  //         });

  //         const messageDocRef = await addDoc(messagesRef, {
  //           senderID: newMessage.senderID,
  //           senderName: newMessage.senderName,
  //           message: newMessage.message,
  //           channelId: newMessage.channelId,
  //           reaction: newMessage.reactions,
  //           answers: newMessage.answers,
  //           timestamp: new Date(),
  //         });

  //         if (this.selectedFile && this.currentUserUid) {
  //           try {
  //             const fileURL = await this.uploadFileService.uploadFileWithIds(this.selectedFile, this.currentUserUid, messageDocRef.id);
  //             newMessage.fileURL = fileURL;
  //             await updateDoc(messageDocRef, { fileURL: newMessage.fileURL });
  //           } catch (error) {
  //             console.error('Datei-Upload fehlgeschlagen:', error);
  //           }
  //         }
  //         const channelIndex = this.channelsService.channels.findIndex(channel => channel.id === this.channelsService.currentChannelId);
  //         // console.log(this.channelsService.channels[channelIndex]);
  //         // console.log(this.channelsService.currentChannelId);


  //         if (channelIndex !== -1) {
  //           // Emit the event to switch to the selected channel's chat window
  //           this.openChannelMessageFromChatEvent.emit({ selectedChannel: this.channelsService.channels[channelIndex], index: channelIndex });
  //         } else {
  //           console.error("Selected channel not found in channels array");
  //         }


  //       } else {
  //         this.showError(); // Fehler, wenn kein Benutzer oder Kanal ausgewählt ist
  //       }

  //       // Eingabefelder bereinigen und Scrollen
  //       this.chatMessage = '';
  //       this.selectedFile = null;
  //       this.scrollToBottom();
  //       this.deleteUpload();
  //     } else {
  //       console.error('Kein Benutzer angemeldet');
  //     }
  //   }
  // }

  // OpenDirectMessage(selectedUserId: string, i: number) {
  //   this.openDirectMessageEvent.emit(); // Ruft die Methode in der Elternkomponente auf
  // }

  // OpenChannelMessage(currentChannelId: string) {
  //   this.openChannelMessageEvent.emit(); // Ruft die Methode in der Elternkomponente auf

  // }

  // scrollToBottom(): void {
  //   if (this.chatWindow) {
  //     try {
  //       this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
  //     } catch (err) {
  //       console.error('Scroll to bottom failed:', err);
  //     }
  //   }
  // }

  // onFileSelected(event: Event) {
  //   const fileInput = event.target as HTMLInputElement;
  //   const file = fileInput.files?.[0];

  //   if (file) {
  //     this.selectedFile = file; // Speichere die ausgewählte Datei

  //     // Datei als base64 speichern, um sie im localStorage zu speichern
  //     const reader = new FileReader();
  //     reader.onload = () => {
  //       const fileData = reader.result as string;
  //       this.filePreviewUrl = fileData; // Speichere die Vorschau-URL für die Datei
  //       localStorage.setItem('selectedFile', JSON.stringify({ fileName: file.name, fileData }));
  //       console.log('File saved to localStorage');
  //     };
  //     reader.readAsDataURL(file);
  //   } else {
  //     console.error('No file selected');
  //   }
  // }

  // deleteUpload() {
  //   this.selectedFile = null;
  //   this.filePreviewUrl = null;
  //   localStorage.removeItem('selectedFile');
  // }

  // // Trigger für verstecktes File-Input
  // triggerFileInput() {
  //   const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  //   fileInput.click();
  // }

  // isImageFile(fileURL: string | null): boolean {
  //   if (!fileURL) return false;

  //   // Extrahiere die Datei-Informationen aus der Firebase-URL und prüfe den Dateinamen
  //   const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
  //   const url = new URL(fileURL);
  //   const fileName = url.pathname.split('/').pop(); // Hole den Dateinamen aus dem Pfad

  //   if (!fileName) return false;

  //   // Prüfe, ob der Dateiname mit einem der Bildformate endet
  //   const fileExtension = fileName.split('.').pop()?.toLowerCase();
  //   return imageExtensions.includes(fileExtension || '');
  // }

  // getFileNameFromURL(url: string | null): string {
  //   if (!url) {
  //     return 'Datei'; // Fallback, falls die URL null ist
  //   }

  //   const decodedUrl = decodeURIComponent(url);
  //   const fileName = decodedUrl.split('?')[0].split('/').pop();
  //   return fileName || 'Datei'; // Wenn kein Dateiname gefunden wird, 'Datei' als Fallback anzeigen
  // }


}