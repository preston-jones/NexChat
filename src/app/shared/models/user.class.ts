type loginState = 'loggedIn' | 'loggedOut' | 'inactive';

export class User {
    id: string;
    email: string | null;
    name: string;
    avatarPath: string | null;
    loginState: loginState;
    channels: string[] = [];
    unreadMessagesCount: number = 0;


    constructor(obj?: any) {
        this.id = obj ? obj.id : null;
        this.email = obj ? obj.email : null;
        this.name = obj ? obj.name : null;
        this.avatarPath = obj ? obj.avatarPath : null;
        this.loginState = obj ? obj.loginState : 'loggedOut';
        this.channels = obj ? obj.channels : null;
    }
}