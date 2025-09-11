import { Injectable } from '@angular/core';
import { AuthService } from '../authentication/auth-service/auth.service';
import { UserService } from '../firestore/user-service/user.service';
import { v4 as uuidv4 } from 'uuid';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { Note } from '../../models/note.class';
import { User } from '../../models/user.class';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  notes: Note[] = [];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private firestore: Firestore,
  ) { }


  async loadNotes(): Promise<void> {
    const noteRef = collection(this.firestore, 'notes');
    const notesQuery = query(noteRef, orderBy('timestamp'));

    onSnapshot(notesQuery, async (snapshot) => {
      // Verarbeite die geladenen Nachrichten
      this.notes = snapshot.docs
        .map(doc => {
          const noteData = doc.data() as Note;
          return {
            ...noteData,
            noteId: doc.id,
            timestamp: noteData.timestamp || new Date(), // Ensure timestamp is set
          };
        })
        .filter(note =>
          note.noteAuthorId === this.authService.currentUserUid);
      this.notes.forEach(async note => {
        this.setNoteDisplayDate(note);
      });
    });
  }


  async createNewNote(note: string, currentUser: User, markedUser: any[] = []) {
    const noteRef = collection(this.firestore, 'notes');

    const markedUserDetails = markedUser.map(user => ({
      id: user.id,
      name: user.name,
    }));

    // Füge die neue Message in Firestore hinzu
    const noteDocRef = await addDoc(noteRef, {
      timestamp: new Date(),
      noteId: '',
      noteAuthorId: currentUser?.id || null,
      authorName: currentUser?.name || '',
      note: note,
      reactions: [],
      fileURL: '',
      markedUser: markedUserDetails || [],
      readedMessage: false,
    });
    // await this.updateMessageFileURL(messageDocRef, conversationId);
    await this.updateNewNote(noteDocRef);
  }


  async updateNewNote(noteDocRef: any) {
    await updateDoc(noteDocRef, {
      noteId: noteDocRef.id,
    });
  }


  formatTimestamp(noteDate: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = noteDate.toDateString() === today.toDateString();
    const isYesterday = noteDate.toDateString() === yesterday.toDateString();

    if (isToday) {
      return 'Heute'; // Wenn die Nachricht von heute ist
    } else if (isYesterday) {
      return 'Gestern'; // Wenn die Nachricht von gestern ist
    } else {
      // Format "13. September"
      return noteDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    }
  }


  setNoteDisplayDate(note: Note | Note) {
    let lastDisplayedDate: string | null = null;

    const noteDate = note.timestamp.toDate();
    const formattedDate = this.formatTimestamp(noteDate);

    // Setze das Anzeigen-Datum
    if (formattedDate !== lastDisplayedDate) {
      note.displayDate = formattedDate;
      lastDisplayedDate = formattedDate;
    } else {
      note.displayDate = null;
    }

    // Setze formattedTimestamp für die Nachricht
    note.formattedTimestamp = noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }


  saveNote(note: Note, editingNoteId: string, editedNote: string) {
    if (note && editingNoteId) {
      const noteRef = doc(this.firestore, `notes/${editingNoteId}`);
      updateDoc(noteRef, { note: editedNote });
    }
  }
}