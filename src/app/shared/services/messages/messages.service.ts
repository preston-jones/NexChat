import { Injectable, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { Firestore, collection, onSnapshot, query, orderBy, where, Timestamp, DocumentSnapshot, QuerySnapshot, DocumentData, doc, getDoc, collectionData, docData } from '@angular/fire/firestore';
import { UserService } from '../firestore/user-service/user.service';
import { Message } from '../../models/message.class';
import { AuthService } from '../authentication/auth-service/auth.service';
import { ChannelsService } from '../channels/channels.service';
import { WorkspaceComponent } from '../../../board/workspace/workspace.component';
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
    lastAnswer: string = '';
    selectedMessage: Message | null = null;
    scrollToMessageId: string | null = null;

    @Output() showThreadEvent = new EventEmitter<void>();
    @ViewChild(WorkspaceComponent) workspaceComponent!: WorkspaceComponent;

    constructor(
        private firestore: Firestore,
        private userService: UserService,
        private authService: AuthService,
        public channelsService: ChannelsService,
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
        
        // Scroll to specific message if requested
        if (this.scrollToMessageId) {
            this.scrollToMessage();
        }
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
                    this.formatLastAnswerTimestamp(messageData);
                    return {
                        ...messageData,
                        messageId: doc.id,
                        timestamp: messageData.timestamp || new Date(), // Ensure timestamp is set
                        isOwnChatMessage: messageData.senderID === this.authService.currentUserUid,
                        senderAvatar, // Resolved avatar
                    };
                })
            );
            this.filterResolvedMessages(resolvedMessages);
            this.findSelectedAnswers();
        });
    }


    findSelectedAnswers() {
        if (this.selectedMessage) {
            const selectedAnswers = this.allChatMessages.find(message => message.messageId === this.selectedMessage?.messageId);
            this.selectedMessage = selectedAnswers || null;
        }
    }


    filterResolvedMessages(resolvedMessages: Message[]) {
        this.allChatMessages = resolvedMessages.filter(message =>
            this.channelsService.currentUserChannels.some(channel => channel.id === message.channelId) // Filter by channel IDs
        );
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


    formatLastAnswerTimestamp(messageData: Message) {
        if (messageData.answers && messageData.answers.length > 0) {
            const lastAnswerTimestamp = messageData.answers[messageData.answers.length - 1].timestamp.toDate();
            const lastAnswerDate = this.formatTimestamp(lastAnswerTimestamp); // e.g., "Heute", "Gestern", or "13. September"
            const lastAnswerTime = lastAnswerTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // e.g., "14:35"
            messageData.lastAnswer = `${lastAnswerDate}, ${lastAnswerTime}`;
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


    setScrollToMessage(messageId: string | null) {
        this.scrollToMessageId = messageId;
    }


    scrollToMessage() {
        if (this.scrollToMessageId) {
            setTimeout(() => {
                const messageElement = document.getElementById(`message-${this.scrollToMessageId}`);
                if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight effect
                    messageElement.classList.add('message-highlight');
                    setTimeout(() => {
                        messageElement.classList.remove('message-highlight');
                    }, 3000);
                }
                this.scrollToMessageId = null;
            }, 100);
        }
    }
}