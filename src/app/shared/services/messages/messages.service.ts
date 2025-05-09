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
    }


    formatMessageContent(message: string | null): string {
        if (!message) return '';
        return message.replace(/\n/g, '<br>');
    }


    async loadMessages(currentUserUid: string | null | undefined, channelId: string) {
        this.currentChatMessages = [];
        const selectedChatMessages = this.allChatMessages.filter(message => message.channelId === channelId)
            .map(m => {
                m.isOwnChatMessage = m.senderID === this.authService.currentUserUid; // Recalculate isOwnMessage
                m.displayDate = this.formatTimestamp(m.timestamp.toDate());
                m.formattedTimestamp = m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return m;
            });
        this.currentChatMessages = selectedChatMessages;
        console.log('Aktuelle Nachrichten:', this.currentChatMessages);
    }


    async loadAllChatMessages(): Promise<void> {
        const messagesRef = collection(this.firestore, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp'));

        onSnapshot(messagesQuery, async (snapshot) => {
            const resolvedMessages = await Promise.all(
                snapshot.docs.map(async doc => {
                    const messageData = doc.data() as Message;
                    const senderAvatar = messageData.senderID
                        ? await this.userService.getSelectedUserAvatar(messageData.senderID)
                        : './assets/images/avatars/avatar5.svg'; // Default avatar

                    return {
                        ...messageData,
                        messageId: doc.id,
                        timestamp: messageData.timestamp || new Date(), // Ensure timestamp is set
                        isOwnChatMessage: messageData.senderID === this.authService.currentUserUid,
                        senderAvatar, // Resolved avatar
                    };
                })
            );

            // Now filter the resolved messages
            this.allChatMessages = resolvedMessages.filter(message =>
                this.channelsService.currentUserChannels.some(channel => channel.id === message.channelId) // Filter by channel IDs
            );

            console.log('Real-time Messages:', this.allChatMessages);
        });
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
        const messageRef = doc(this.firestore, 'messages', messageId);
        updateDoc(messageRef, { [`answers.senderName`]: senderName });
    }


    updateSendernameOfMessage(messageId: string, senderName: string) {
        const messageRef = doc(this.firestore, 'messages', messageId);
        updateDoc(messageRef, { senderName: senderName });
    }
}