import { Timestamp } from "firebase/firestore";

export class Note {

    timestamp: Timestamp;
    noteId: string;
    authorName: string | null;
    note: string | null;
    reactions: { emoji: string; senderID: string; senderName: string; count: number }[] = [];
    formattedTimestamp: string;
    displayDate: string | null;
    noteAuthorId: string | null | undefined;
    fileURL: string | null;
    markedUser: { id: string; name: string }[] = [];

    constructor(obj?: any, currentUserUid?: string | null) {
        this.timestamp = obj ? obj.timestamp : null;
        this.noteId = obj ? obj.noteId : null;
        this.noteAuthorId = obj ? obj.noteAuthorId : null;
        this.authorName = obj ? obj.authorName : null;
        this.note = obj ? obj.note : null;
        this.reactions = obj?.reactions || [];
        this.formattedTimestamp = '';
        this.displayDate = null;
        this.fileURL = obj ? obj.fileURL : null;
        this.markedUser = obj?.markedUser || [];
    }
}