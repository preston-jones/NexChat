import { EventEmitter, HostListener, Injectable } from '@angular/core';
import { Channel } from '../../models/channel.class';
import { User } from '../../models/user.class';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserService } from '../firestore/user-service/user.service';

@Injectable({
  providedIn: 'root'
})
export class ChatUtilityService {
  users = this.userService.users;
  showChatWindow: boolean = true;
  showChannelMessage: boolean = false;
  showDirectMessage: boolean = false;
  directMessageUser: User | null = null;
  selectedChannel: Channel | null = null;
  messageIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  messageId$: Observable<string | null> = this.messageIdSubject.asObservable();
  selectedUser: User | null = null;
  isSmallScreen: boolean = window.innerWidth < 1080;

  public openDirectMessageEvent: EventEmitter<{ selectedUser: User, index: number }> = new EventEmitter();
  public openChannelMessageEvent: EventEmitter<{ selectedChannel: Channel, index: number }> = new EventEmitter();

  constructor(private userService: UserService,) { }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.isSmallScreen = window.innerWidth < 1080;
    this.adjustDrawerStylesForSmallScreen();
  }

  openChannelMessage() {
    this.showChannelMessage = true;
    this.showDirectMessage = false;
    this.showChatWindow = false;
    this.adjustDrawerStylesForSmallScreen();
  }

  openChannelMessageFromChat(selectedChannel: Channel, index: number) {
    this.showChannelMessage = true;
    this.showDirectMessage = false;
    this.showChatWindow = false;
    this.openChannelMessageEvent.emit({ selectedChannel, index });
    this.adjustDrawerStylesForSmallScreen();
  }

  openDirectMessage() {
    this.showDirectMessage = true;
    this.showChannelMessage = false;
    this.showChatWindow = false;
    this.adjustDrawerStylesForSmallScreen();
  }

  openDirectMessageFromChat(selectedUser: User, index: number) {
    this.showDirectMessage = true;
    this.showChannelMessage = false;
    this.showChatWindow = false;
    this.openDirectMessageEvent.emit({ selectedUser, index });
    this.adjustDrawerStylesForSmallScreen();
  }

  openChatWindow() {
    this.showChatWindow = true;
    this.showDirectMessage = false;
    this.showChannelMessage = false;
    this.setMessageId(null);
    this.directMessageUser = null;
    this.selectedChannel = null;
    this.selectedUser = null;
    this.userService.selectedUser = null;
  }


  setMessageId(messageId: string | null) {
    this.messageIdSubject.next(messageId);
  }

  adjustDrawerStylesForSmallScreen(): void {
    if (!this.isSmallScreen) return;

    const drawerContainer = document.querySelector('.mat-drawer-container') as HTMLElement;
    const drawer = document.querySelector('.mat-drawer') as HTMLElement;
    const sidenavContent = document.querySelector('.sidenav-content') as HTMLElement;
    const mobileBackArrow = document.querySelector('.mobile-back-arrow') as HTMLElement;
    const groupLogo = document.querySelector('.group-logo') as HTMLElement;
    const logoContainer = document.querySelector('.logo-container') as HTMLElement;

    if (drawerContainer) {

      drawer.style.removeProperty('transform');
      sidenavContent.style.display = 'flex';
      mobileBackArrow.style.display = 'flex';
      groupLogo.style.display = 'flex';
      logoContainer.style.display = 'none';

    } else {
      console.warn('Element mit der Klasse mat-drawer-container wurde nicht gefunden.');
    }
  }
}