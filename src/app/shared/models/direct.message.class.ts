import { Timestamp } from "firebase/firestore";
export class DirectMessage {
    timestamp: Timestamp;
    messageId: string | null;
    senderId: string | null;
    senderName: string | null;
    message: string | null;
    reactions: { emoji: string; senderID: string; senderName: string; count: number }[] = [];
    formattedTimestamp: string;
    isOwnMessage: boolean = false;
    displayDate: string | null;
    senderAvatar: string | null | undefined;
    fileURL: string | null;
    receiverId: string | null;
    receiverName: string | null;

    constructor(obj?: any, currentUserUid?: string | null) {
        this.timestamp = obj ? obj.timestamp : null;
        this.messageId = obj ? obj.messageId : null;
        this.senderId = obj ? obj.senderId : null;
        this.senderName = obj ? obj.senderName : null;
        this.message = obj ? obj.message : null;
        this.reactions = obj?.reactions || [];
        this.formattedTimestamp = '';
        this.displayDate = null;
        this.fileURL = obj ? obj.fileURL : null;
        this.receiverId = obj ? obj.receiverId : null;
        this.receiverName = obj ? obj.receiverName : null;

        // Typensicherer Vergleich, um sowohl null als auch undefined abzudecken
        if (currentUserUid && this.senderId) {
            this.isOwnMessage = this.senderId === currentUserUid;
        }
    }
}