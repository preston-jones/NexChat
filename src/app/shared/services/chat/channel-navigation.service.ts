import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Channel } from '../../models/channel.class';


@Injectable({
    providedIn: 'root'
})
export class ChannelNavigationService {
    private channelSelectedSource = new Subject<{ channel: Channel, index: number }>();
    channelSelected$ = this.channelSelectedSource.asObservable();

    selectChannel(channel: Channel, index: number) {
        this.channelSelectedSource.next({ channel, index });
    }
}