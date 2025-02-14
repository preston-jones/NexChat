export class Note {
    noteId: string;
    noteOwnerId: string;
    note: string;
    formattedTimestamp: string;
    fileURL: string | null;

    constructor(obj?: any) {
        this.noteId = obj ? obj.noteId : null;
        this.noteOwnerId = obj ? obj.noteOwnerId : null;
        this.note = obj ? obj.note : null;
        this.formattedTimestamp = '';
        this.fileURL = obj ? obj.fileURL : null;
    }
}