import { Timestamp } from "firebase/firestore";

export class Note {

    timestamp: Timestamp;
    noteId: string | null;
    noteAuthorId: string | null;
    note: string | null;
    formattedTimestamp: string;
    fileURL: string | null;
    displayDate: string | null;
    constructor(obj?: any) {
        this.timestamp = obj ? obj.timestamp : null;
        this.noteId = obj ? obj.noteId : null;
        this.noteAuthorId = obj ? obj.noteAuthorId : null;
        this.note = obj ? obj.note : null;
        this.formattedTimestamp = '';
        this.fileURL = obj ? obj.fileURL : null;
        this.displayDate = null;
    }
}