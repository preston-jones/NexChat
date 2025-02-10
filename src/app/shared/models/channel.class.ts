export class Channel {
    id: string;
    name: string;
    description: string;
    members: string[] | any[];
    memberUids: string[];
    channelAuthor: string;
    channelAuthorId: string;

    constructor(obj? : any) {
        this.id = obj ? obj.id : null;
        this.name = obj ? obj.name : null;
        this.description = obj ? obj.description : null;
        this.members = Array.isArray(obj?.members) ? obj.members : []; 
        this.memberUids = obj? obj.memberUids : [];
        this.channelAuthor = obj ? obj.channelAuthor : null;
        this.channelAuthorId = obj ? obj.channelAuthorId : null;
    }
}
