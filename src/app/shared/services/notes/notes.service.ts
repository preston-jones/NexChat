import { Injectable } from '@angular/core';
import { AuthService } from '../authentication/auth-service/auth.service';
import { UserService } from '../firestore/user-service/user.service';
import { addDoc, arrayUnion, collection, doc, Firestore, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { Note } from '../../models/note.class';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private firestore: Firestore
      ) {}
}