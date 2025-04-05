import { Injectable, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { Firestore, collection, onSnapshot, query, orderBy, where, Timestamp, DocumentSnapshot, QuerySnapshot, DocumentData, doc, getDoc, collectionData, docData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../firestore/user-service/user.service';
import { Message } from '../../models/message.class';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { UploadFileService } from '../firestore/storage-service/upload-file.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { WorkspaceComponent } from '../../../board/workspace/workspace.component';
import { ChatUtilityService } from './chat-utility.service';
import { getDocs, updateDoc } from 'firebase/firestore';


@Injectable({
    providedIn: 'root'
})
export class MessagesService {
    allChatMessages: Message[] = [];
    chatMessage: string = '';
    editingMessageId: string | null = null;
    showMessageEditArea: boolean = false;
    showMessageEdit = false;
    showEmojiPicker: boolean = false;
    currentChatMessages: Message[] = [];
    currentUserUid = this.authService.currentUser()?.id;
    messageArea = true;
    editedMessage = '';
    channelId = this.channelsService.currentChannelId;
    senderAvatar: string | null = null;
    senderName: string | null = null;
    selectedFile: File | null = null;// Service für den Datei-Upload
    filePreviewUrl: string | null = null;
    lastAnswer: string = '';
    selectedMessage: Message | null = null;

    @Output() showThreadEvent = new EventEmitter<void>();
    @ViewChild(WorkspaceComponent) workspaceComponent!: WorkspaceComponent;

    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private userService: UserService,
        private uploadFileService: UploadFileService,
        private authService: AuthService,
        public channelsService: ChannelsService,
        private chatUtilityService: ChatUtilityService
    ) { }


    toggleMessageEdit() {
        this.showMessageEditArea = !this.showMessageEditArea;
    }


    showMessageEditToggle() {
        this.showMessageEdit = !this.showMessageEdit;
    }


    editMessage(messageId: string) {
        this.editingMessageId = messageId;
        this.showMessageEditArea = true;
    }


    cancelMessageEdit() {
        this.editingMessageId = null;
        this.showMessageEditArea = false;
    }


    isEditing(messageId: string): boolean {
        return this.editingMessageId === messageId;
    }


    showEmoji() {
        this.showEmojiPicker = !this.showEmojiPicker;
    }


    addEmoji(event: any) {
        this.chatMessage += event.emoji.native;
        console.log(event.emoji.native);
    }


    toggleEmojiPicker() {
        this.showEmojiPicker = !this.showEmojiPicker;
    }


    @HostListener('document:click', ['$event'])
    clickOutside(event: Event) {
        const target = event.target as HTMLElement;
        if (this.showEmojiPicker && !target.closest('emoji-mart') && !target.closest('.message-icon')) {
            this.showEmojiPicker = false;
        }
    }


    showThread() {
        this.showThreadEvent.emit();
        console.log();

    }


    async loadMessages(currentUserUid: string | null | undefined, channelId: string) {
        const messagesQuery = this.createMessageQuery(channelId);

        onSnapshot(messagesQuery, async (snapshot) => {
            // Verarbeite die geladenen Nachrichten
            this.currentChatMessages = await this.processSnapshot(snapshot, currentUserUid);

            // Lade alle Antworten für jede geladene Nachricht
            await Promise.all(this.currentChatMessages.map(async (message: Message) => {
                await this.loadAnswersForMessage(message);
            }));
        });        
    }


    async loadAllChatMessages(): Promise<Message[]> {
        let messagesRef = collection(this.firestore, 'messages');
        let messagesQuery = query(messagesRef);
        const querySnapshot = await getDocs(messagesQuery);
        this.allChatMessages = querySnapshot.docs.map(doc => {
            let messageData = doc.data() as Message;
            return { ...messageData, id: doc.id };
        });
        return this.allChatMessages;
    }


    async loadAnswersForMessage(message: Message) {
        const messageRef = doc(this.firestore, 'messages', message.messageId);
        const messageSnap = await getDoc(messageRef);

        if (messageSnap.exists()) {
            const messageData = messageSnap.data();
            const answers = messageData['answers'] || []; // Antworten abrufen

            // Setze lastAnswer auf den Timestamp der letzten Antwort, falls Antworten vorhanden sind
            if (answers.length > 0) {
                const lastAnswerTimestamp = answers[answers.length - 1].timestamp;
                if (lastAnswerTimestamp && lastAnswerTimestamp.seconds) {
                    const lastAnswerDate = new Date(lastAnswerTimestamp.seconds * 1000);
                    message.lastAnswer = this.formatTimestamp(lastAnswerDate); // Formatierung mit der Funktion
                } else {
                    message.lastAnswer = null;
                }
            } else {
                message.lastAnswer = null;
            }

            // Lade alle Antworten als Message-Objekte
            message.answers = await Promise.all(answers.map(async (answerData: any) => {
                const answerMessage = new Message(answerData, this.currentUserUid);

                if (answerMessage.senderID) {
                    const senderUser = await this.userService.getSelectedUserById(answerMessage.senderID);
                    answerMessage.senderAvatar = senderUser?.avatarPath || './assets/images/avatars/avatar5.svg';
                } else {
                    answerMessage.senderAvatar = './assets/images/avatars/avatar5.svg'; // Standard-Avatar
                }

                const answerDate = new Date(answerData.timestamp.seconds * 1000);
                answerMessage.formattedTimestamp = this.formatTimestamp(answerDate); // Formatierung mit der Funktion

                return answerMessage;
            }));
        } else {
            console.error(`Message ${message.messageId} exists nicht`);
        }
    }


    private createMessageQuery(channelId: string) {
        const messagesRef = collection(this.firestore, 'messages');

        // Filtere die Nachrichten nach der übergebenen channelId
        return query(
            messagesRef,
            where('channelId', '==', channelId), // Filter nach channelId
            orderBy('timestamp')
        );
    }


    private async processSnapshot(snapshot: any, currentUserUid: string | null | undefined) {
        let lastDisplayedDate: string | null = null;

        return Promise.all(snapshot.docs.map(async (doc: DocumentSnapshot) => {
            const message = await this.mapMessageData(doc, currentUserUid);
            const messageData = doc.data(); // Hier abrufen

            // Sicherstellen, dass messageData definiert ist
            if (messageData) {
                const messageDate = new Date(messageData['timestamp']?.seconds * 1000);
                const formattedDate = this.formatTimestamp(messageDate);

                if (formattedDate !== lastDisplayedDate) {
                    message.displayDate = formattedDate;
                    lastDisplayedDate = formattedDate;
                } else {
                    message.displayDate = null;
                }
            }

            return message;
        }));
    }

    private async mapMessageData(doc: DocumentSnapshot, currentUserUid: string | null | undefined) {
        const messageData = doc.data();

        // Sicherstellen, dass messageData definiert ist
        if (!messageData) {
            throw new Error('Message data is undefined'); // Fehlerbehandlung
        }

        const message = new Message(messageData, currentUserUid);
        message.messageId = doc.id;
        message.isOwnChatMessage = message.senderID === currentUserUid;

        if (message.senderID) {
            const senderUser = await this.userService.getSelectedUserById(message.senderID);
            message.senderAvatar = senderUser?.avatarPath || './assets/images/avatars/avatar5.svg';
        } else {
            message.senderAvatar = './assets/images/avatars/avatar5.svg';
        }

        // Sicherstellen, dass timestamp definiert ist
        const messageDate = new Date(messageData['timestamp']?.seconds * 1000);
        message.formattedTimestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return message;
    }


    formatTimestamp(messageDate: Date): string {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const isToday = messageDate.toDateString() === today.toDateString();
        const isYesterday = messageDate.toDateString() === yesterday.toDateString();

        if (isToday) {
            return 'Heute'; // Wenn die Nachricht von heute ist
        } else if (isYesterday) {
            return 'Gestern'; // Wenn die Nachricht von gestern ist
        } else {
            // Format "13. September"
            return messageDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
        }
    }


    async getMessagesFromCurrentUser() {
        const q = query(collection(this.firestore, 'messages'), where('senderID', '==', this.authService.currentUserUid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
            const message = doc.data() as Message;
            this.updateSendernameOfMessage(doc.id, this.authService.currentUser()?.name as string);

            if (message.answers) {
                const answers = message['answers'] || []; // Antworten abrufen
                for (let i = 0; i < answers.length; i++) {
                    if (answers[i].senderID === this.authService.currentUserUid) {
                        console.log(answers[i]);
                        this.updateSendernameOfAnswer(doc.id, this.authService.currentUser()?.name as string, i);
                    }
                }

            }
        });
    }


    updateSendernameOfAnswer(messageId: string, senderName: string, answerIndex: number) {
        // const messageRef = doc(this.firestore, 'messages', messageId);
        // updateDoc(messageRef, { [`answers.senderName`]: senderName });
    }


    updateSendernameOfMessage(messageId: string, senderName: string) {
        const messageRef = doc(this.firestore, 'messages', messageId);
        updateDoc(messageRef, { senderName: senderName });
    }
}