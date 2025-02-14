import { Injectable, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { Firestore, collection, onSnapshot, query, orderBy, where, Timestamp, DocumentSnapshot, QuerySnapshot, DocumentData, doc, getDoc, collectionData, docData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../firestore/user-service/user.service';
import { Message } from '../../models/message.class';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { UploadFileService } from '../firestore/storage-service/upload-file.service';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { DirectMessage } from '../../models/direct.message.class';
import { User } from '../../models/user.class';
import { WorkspaceComponent } from '../../../board/workspace/workspace.component';
import { ChatUtilityService } from './chat-utility.service';
import { getDocs, updateDoc } from 'firebase/firestore';


@Injectable({
    providedIn: 'root'
})
export class MessagesService {
    users: User[] = [];
    chatMessage: string = '';
    editingMessageId: string | null = null;
    showMessageEditArea: boolean = false;
    showMessageEdit = false;
    showEmojiPicker: boolean = false;
    messages: Message[] = [];
    directMessages: DirectMessage[] = [];
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
    ) {

    }


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
    }

    async loadMessages(currentUserUid: string | null | undefined, channelId: string) {
        const messagesQuery = this.createMessageQuery(channelId);

        onSnapshot(messagesQuery, async (snapshot) => {
            // Verarbeite die geladenen Nachrichten
            this.messages = await this.processSnapshot(snapshot, currentUserUid);

            // Lade alle Antworten für jede geladene Nachricht
            await Promise.all(this.messages.map(async (message: Message) => {
                await this.loadAnswersForMessage(message);
            }));
        });
    }

    async loadMessagesAsPromise(): Promise<Message[]> {
        let messagesRef = collection(this.firestore, 'messages');
        let messagesQuery = query(messagesRef);
        const querySnapshot = await getDocs(messagesQuery);
        this.messages = querySnapshot.docs.map(doc => {
            let messageData = doc.data() as Message;
            return { ...messageData, id: doc.id };
        });
        return this.messages;
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

    async loadDirectMessages(currentUserUid: string | undefined, targetUserId: string | undefined) {
        if (targetUserId) {
            // Lade den Benutzer basierend auf der targetUserId und setze selectedUser
            this.chatUtilityService.directMessageUser = await this.loadSelectedUser(targetUserId);
        }

        const messagesRef = collection(this.firestore, 'direct_messages');
        const sentMessagesQuery = this.createSentMessagesQuery(messagesRef, currentUserUid, targetUserId);
        const receivedMessagesQuery = this.createReceivedMessagesQuery(messagesRef, currentUserUid, targetUserId);

        const unsubscribeSent = this.subscribeToSentMessages(sentMessagesQuery, currentUserUid);
        const unsubscribeReceived = this.subscribeToReceivedMessages(receivedMessagesQuery, currentUserUid);

        // Optional: Rückgabefunktion zum Abmelden von Snapshots
        return () => {
            unsubscribeSent();
            unsubscribeReceived();
        };
    }


    async loadDirectMessagesAsPromise(): Promise<DirectMessage[]> {
        let directMessagesRef = collection(this.firestore, 'direct_messages');
        let directMessagesQuery = query(directMessagesRef);
        const querySnapshot = await getDocs(directMessagesQuery);

        this.directMessages = querySnapshot.docs.map(doc => {
            let directMessageData = doc.data() as DirectMessage;
            return { ...directMessageData, id: doc.id, timestamp: directMessageData.timestamp || new Date() };
        });

        return this.directMessages;
    }


    private async loadSelectedUser(targetUserId: string) {
        return await this.userService.getSelectedUserById(targetUserId);
    }

    private createSentMessagesQuery(messagesRef: any, currentUserUid: string | undefined, targetUserId: string | null | undefined) {
        return query(
            messagesRef,
            where('senderId', '==', currentUserUid),
            where('receiverId', '==', targetUserId),
            orderBy('timestamp')
        );
    }

    private createReceivedMessagesQuery(messagesRef: any, currentUserUid: string | undefined, targetUserId: string | null | undefined) {
        return query(
            messagesRef,
            where('receiverId', '==', currentUserUid),
            where('senderId', '==', targetUserId),
            orderBy('timestamp')
        );
    }

    private subscribeToSentMessages(sentMessagesQuery: any, currentUserUid: string | undefined) {
        return onSnapshot(sentMessagesQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
            this.directMessages = await this.processMessages(snapshot, currentUserUid, true);
        });
    }

    private subscribeToReceivedMessages(receivedMessagesQuery: any, currentUserUid: string | undefined) {
        return onSnapshot(receivedMessagesQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
            const receivedMessages = await this.processMessages(snapshot, currentUserUid, false);
            this.directMessages = [...this.directMessages.filter(m => m.isOwnMessage), ...receivedMessages];
        });
    }

    private async processMessages(snapshot: QuerySnapshot<DocumentData>, currentUserUid: string | undefined, isSent: boolean) {
        let lastDisplayedDate: string | null = null;

        return Promise.all(snapshot.docs.map(async (doc) => {
            const messageData = doc.data();
            const message = new DirectMessage(messageData, currentUserUid);
            const conversation: DirectMessage[] = messageData['conversation'];
            message.messageId = doc.id;

            await this.processConversation(conversation, currentUserUid, lastDisplayedDate);
            this.chatUtilityService.setMessageId(doc.id);

            return message;
        }));
    }

    private async processConversation(conversation: DirectMessage[], currentUserUid: string | undefined, lastDisplayedDate: string | null) {
        await Promise.all(conversation.map(async (msg: DirectMessage) => {
            await this.loadSenderAvatar(msg);
            this.setMessageDisplayDate(msg, lastDisplayedDate, currentUserUid);
        }));
    }

    private async loadSenderAvatar(msg: DirectMessage) {
        if (msg.senderId) {
            const senderUser = await this.userService.getSelectedUserById(msg.senderId);
            msg.senderAvatar = senderUser?.avatarPath || './assets/images/avatars/avatar5.svg';
        } else {
            msg.senderAvatar = './assets/images/avatars/avatar5.svg';
        }
    }

    private setMessageDisplayDate(msg: DirectMessage, lastDisplayedDate: string | null, currentUserUid: string | undefined) {
        const messageTimestamp = msg.timestamp;
        if (messageTimestamp instanceof Timestamp) {
            const messageDate = messageTimestamp.toDate();
            const formattedDate = this.formatTimestamp(messageDate);
            msg.isOwnMessage = msg.senderId === currentUserUid;

            // Setze das Anzeigen-Datum
            if (formattedDate !== lastDisplayedDate) {
                msg.displayDate = formattedDate;
                lastDisplayedDate = formattedDate;
            } else {
                msg.displayDate = null;
            }

            // Setze formattedTimestamp für die Nachricht
            msg.formattedTimestamp = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            console.error("Timestamp is not defined or in the expected format.", msg);
        }
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

    getUserName(user: User) {
        this.chatUtilityService.directMessageUser = user;
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
                        this.updateSendernameOfAnswer(doc.id, this.authService.currentUser()?.name as string, i);
                    }
                }

            }
        });
    }


    // async getMessagesFromCurrentUser() {
    //     const q = query(collection(this.firestore, 'messages'), where('senderID', '==', this.authService.currentUserUid));
    //     const querySnapshot = await getDocs(q);
    //     querySnapshot.forEach(async (doc) => {
    //         const message = doc.data() as Message;
    //         if (message.senderID === this.authService.currentUserUid) {
    //             this.updateSendernameOfMessage(doc.id, this.authService.currentUser()?.name as string);
    //         }
    //     });
    // }


    updateSendernameOfMessage(messageId: string, senderName: string) {
        const messageRef = doc(this.firestore, 'messages', messageId);
        updateDoc(messageRef, { senderName: senderName });
    }


    updateSendernameOfAnswer(messageId: string, senderName: string, answerIndex: number) {
        // const messageRef = doc(this.firestore, 'messages', messageId);
        // updateDoc(messageRef, { [`answers.senderName`]: senderName });
        // updateSendernameOfAnswer(messageId: string, senderName: string, answerIndex: number) {
        //     const messageRef = doc(this.firestore, 'messages', messageId);

    }

    async loadConversations(message: DirectMessage): Promise<void> {
        const messageDocRef = doc(this.firestore, `direct_messages/${message.messageId}`);

        try {
            // Hole das Dokument mit der angegebenen messageId
            const docSnapshot = await getDoc(messageDocRef);

            if (docSnapshot.exists()) {
                // Extrahiere die Konversationen
                const data = docSnapshot.data();
                const conversations = data?.['conversation'] || []; // Default auf leeres Array, falls keine Konversationen vorhanden sind

                // Verarbeite die Konversationen
                console.log(conversations);

                // Beispiel: Jede Nachricht in der Konversation ausgeben
                conversations.forEach((conv: any) => {
                    console.log(`Sender: ${conv.senderName}, Nachricht: ${conv.message}`);
                });
            } else {
                console.error('Dokument nicht gefunden!');
            }
        } catch (error) {
            console.error('Fehler beim Laden der Konversationen:', error);
        }
    }


    // neuer service?
    async setAllMessagesAsRead(): Promise<void> {
        try {
            // Referenz zur gesamten Sammlung `direct_messages`
            const messagesCollectionRef = collection(this.firestore, 'direct_messages');

            // Abrufen aller Dokumente innerhalb der Sammlung
            const querySnapshot = await getDocs(messagesCollectionRef);

            // Durchlaufe jedes Dokument in der Sammlung
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                const conversations = data['conversation'] || [];

                // Aktualisiere nur die Konversationen, bei denen `receiverId` der aktuelle Benutzer ist
                let updatedConversations = conversations.map((conv: any) => {

                    if (conv.receiverId === this.authService.currentUserUid && !conv.readedMessage) {
                        return { ...conv, readedMessage: true };
                    }
                    return conv;
                });


                // Überschreibe das Dokument mit den aktualisierten Konversationen
                await updateDoc(doc.ref, { conversation: updatedConversations });
                this.listenToConversations()
            }

            // console.log('Alle Nachrichten wurden als gelesen markiert.');
        } catch (error) {
            console.error('Fehler beim Aktualisieren der Nachrichten:', error);
        }
    }

    async listenToConversations(): Promise<void> {
        try {
            // Referenz zur gesamten Sammlung `direct_messages`
            const messagesCollectionRef = collection(this.firestore, 'direct_messages');

            // Filtere die Konversationen, bei denen der aktuelle Benutzer der Empfänger ist
            const q = query(
                messagesCollectionRef,
                where('conversation.receiverId', '==', this.authService.currentUserUid) // nur Konversationen des aktuellen Benutzers
            );

            // Listener für Echtzeit-Updates
            onSnapshot(q, (querySnapshot) => {
                // Mapping der ungelesenen Nachrichten pro Sender
                const unreadMessagesBySender: { [key: string]: number } = {};

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const conversations = data['conversation'] || [];

                    // Filtere ungelesene Nachrichten
                    const userConversations = conversations.filter((conv: any) =>
                        conv.receiverId === this.currentUserUid && !conv.readedMessage
                    );

                    // Zähle ungelesene Nachrichten für jeden Sender
                    userConversations.forEach((conv: any) => {
                        if (!unreadMessagesBySender[conv.senderId]) {
                            unreadMessagesBySender[conv.senderId] = 0;
                        }
                        unreadMessagesBySender[conv.senderId]++;
                    });
                });

                // Aktualisiere die Benutzerliste mit der Anzahl ungelesener Nachrichten
                this.users = this.users.map((user) => {
                    return {
                        ...user,
                        unreadMessagesCount: unreadMessagesBySender[user.id] || 0, // Standardwert: 0
                    };
                });

                // console.log('Ungelesene Nachrichten pro Sender:', unreadMessagesBySender);
            });
        } catch (error) {
            console.error('Fehler beim Überwachen der Konversationen:', error);
        }
    }
}