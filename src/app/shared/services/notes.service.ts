import { Injectable } from '@angular/core';
import { AuthService } from './authentication/auth-service/auth.service';
import { UserService } from './firestore/user-service/user.service';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { Note } from '../models/note.class';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  notes: Note[] = [];
  currentUserId = this.authService.currentUserUid;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private firestore: Firestore
  ) {
    this.loadNotes();
    console.log('NoteService.constructor: ', this.notes);
    
  }


  async loadNotes() {

    const messagesRef = collection(this.firestore, 'notes');
    const notesQuery = this.createNoteQuery(messagesRef);

    const unsubscribeSent = this.subscribeToNotes(notesQuery);

    // Optional: Rückgabefunktion zum Abmelden von Snapshots
    // return () => {
    //   unsubscribeSent();
    //   unsubscribeReceived();
    // };
  }


  private createNoteQuery(messagesRef: any) {
    return query(
      messagesRef,
      where('noteOwnerId', '==', this.currentUserId),
      orderBy('timestamp')
    );
  }


  private subscribeToNotes(notesQuery: any) {
    return onSnapshot(notesQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
      this.notes = await this.processNotes(snapshot);
    });
  }


  private async processNotes(snapshot: QuerySnapshot<DocumentData>) {
    let lastDisplayedDate: string | null = null;

    return Promise.all(snapshot.docs.map(async (doc) => {
      const noteData = doc.data();
      const note = new Note(noteData);
      note.noteId = doc.id;

      return note;
    }));
  }


  async addNote(note: string) {

    const notesRef = collection(this.firestore, 'notes');

    const noteDocRef = await addDoc(notesRef, {
      noteId: '',
      noteOwnerId: this.authService.currentUserUid,
      note: note,
      timestamp: new Date(),
      fileURL: '', // Platzhalter für Datei-URL
    });

    updateDoc(noteDocRef, {
      noteId: noteDocRef.id
    });

    console.log('Notiz hinzugefügt: ', note);
  }
}