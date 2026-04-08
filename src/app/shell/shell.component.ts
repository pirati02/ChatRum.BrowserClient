import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { AccountsService } from '../services/accounts.service';
import { ChatService } from '../services/chat.service';
import { FriendshipService } from '../services/frienship.service';
import { SelectedAccountService } from '../services/selected-account.service';
import { InlineModalComponent } from '../shared/inline-modal/inline-modal.component';
import { AccountInfoComponent } from '../routes/accounts/account-info/account-info.component';
import { NotificationsService } from '../services/notifications.service';
import { NotificationItem } from '../models/notification';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    InlineModalComponent,
    AccountInfoComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  accountModalOpen = false;
  notificationModalOpen = false;
  loggedInAccountId: string | null = null;
  url = '';
  private routerSub?: Subscription;
  private unreadSub?: Subscription;
  private notificationsSub?: Subscription;
  private chatMessageSub?: Subscription;
  unreadCount = 0;
  notifications: NotificationItem[] = [];
  chatAlerts: { id: string; message: string; chatId: string }[] = [];

  constructor(
    private selectedAccount: SelectedAccountService,
    private accounts: AccountsService,
    private router: Router,
    private auth: AuthService,
    private chat: ChatService,
    private friendship: FriendshipService,
    private notificationsService: NotificationsService,
  ) {}

  ngOnInit(): void {
    this.loggedInAccountId = this.auth.getJwtClaims()?.sub ?? null;
    if (this.loggedInAccountId) {
      this.chat.startConnection(this.loggedInAccountId);
      this.notificationsService.startConnection(this.loggedInAccountId);
      this.notificationsService.loadInitial().subscribe({
        next: (page) => this.notificationsService.setNotifications(page.items ?? []),
      });
      this.notificationsService.loadUnreadCount().subscribe({
        next: (response) => this.notificationsService.setUnreadCount(response.unreadCount ?? 0),
      });
    }

    this.unreadSub = this.notificationsService.unreadCount$.subscribe((value) => {
      this.unreadCount = value;
    });
    this.notificationsSub = this.notificationsService.notifications$.subscribe((value) => {
      this.notifications = value;
    });
    this.chatMessageSub = this.chat.chatAppendMessage$.subscribe((payload) => {
      this.handleIncomingChatMessage(payload?.message);
    });

    this.url = this.router.url;
    
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url = e.urlAfterRedirects;
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
    this.notificationsSub?.unsubscribe();
    this.chatMessageSub?.unsubscribe();
  }

  logout(): void {
    this.chat.stopConnection();
    this.friendship.stopConnection();
    this.notificationsService.stopConnection();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  toggleNotificationModal(): void {
    this.notificationModalOpen = !this.notificationModalOpen;
  }

  openNotification(notification: NotificationItem): void {
    this.notificationModalOpen = false;
    this.markNotificationAsRead(notification);
    void this.navigateToNotificationTarget(notification);
  }

  acceptFriendRequest(notification: NotificationItem, event: Event): void {
    event.stopPropagation();
    const accountId = this.loggedInAccountId;
    if (!accountId) {
      return;
    }

    this.friendship
      .acceptFriendRequest(
        { peerId: accountId, userName: '' },
        { peerId: notification.targetId, userName: notification.actorDisplayName },
      )
      .subscribe({
        next: () => this.markNotificationAsRead(notification),
      });
  }

  rejectFriendRequest(notification: NotificationItem, event: Event): void {
    event.stopPropagation();
    const accountId = this.loggedInAccountId;
    if (!accountId) {
      return;
    }

    this.friendship
      .rejectFriendRequest(
        { peerId: accountId, userName: '' },
        { peerId: notification.targetId, userName: notification.actorDisplayName },
      )
      .subscribe({
        next: () => this.markNotificationAsRead(notification),
      });
  }

  markNotificationAsRead(notification: NotificationItem): void {
    if (notification.isRead) {
      return;
    }

    this.notificationsService.markRead(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        );
        this.notificationsService.setNotifications(this.notifications);
        this.notificationsService.setUnreadCount(Math.max(0, this.unreadCount - 1));
      },
    });
  }

  markAllNotificationsAsRead(): void {
    this.notificationsService.markAllRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) => ({ ...item, isRead: true }));
        this.notificationsService.setNotifications(this.notifications);
        this.notificationsService.setUnreadCount(0);
      },
    });
  }

  notificationMessage(notification: NotificationItem): string {
    switch (notification.type) {
      case 'PostComment':
        return `${notification.actorDisplayName} commented on your post`;
      case 'CommentReply':
        return `${notification.actorDisplayName} replied to your comment`;
      case 'PostReaction':
        return `${notification.actorDisplayName} reacted to your post`;
      case 'CommentReaction':
        return `${notification.actorDisplayName} reacted to your comment`;
      case 'FriendRequestReceived':
        return `${notification.actorDisplayName} sent you a friend request`;
      case 'FriendRequestAccepted':
        return `${notification.actorDisplayName} accepted your friend request`;
      case 'FriendRequestRejected':
        return `${notification.actorDisplayName} rejected your friend request`;
      default:
        return `${notification.actorDisplayName} interacted with your content`;
    }
  }

  canTakeFriendRequestAction(notification: NotificationItem): boolean {
    return notification.type === 'FriendRequestReceived' && !notification.isRead;
  }

  dismissChatAlert(alertId: string, event?: Event): void {
    event?.stopPropagation();
    this.chatAlerts = this.chatAlerts.filter((item) => item.id !== alertId);
  }

  openChatFromAlert(alertId: string, chatId: string): void {
    this.dismissChatAlert(alertId);
    void this.router.navigate(['/chat'], { queryParams: { chatId } });
  }

  relativeTime(isoDate: string): string {
    const now = Date.now();
    const then = new Date(isoDate).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSeconds < 60) {
      return 'just now';
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private async navigateToNotificationTarget(notification: NotificationItem): Promise<void> {
    const accountId = await this.resolveNotificationAccountId();
    if (!accountId) {
      await this.router.navigate(['/']);
      return;
    }

    if (notification.type === 'PostComment' || notification.type === 'PostReaction') {
      await this.router.navigate(['/feed', accountId, 'post', notification.targetId]);
      return;
    }

    if (
      notification.type === 'FriendRequestReceived' ||
      notification.type === 'FriendRequestAccepted' ||
      notification.type === 'FriendRequestRejected'
    ) {
      await this.router.navigate(['/friends']);
      return;
    }

    await this.router.navigate(['/feed', accountId]);
  }

  private resolveNotificationAccountId(): Promise<string | null> {
    if (this.loggedInAccountId) {
      return Promise.resolve(this.loggedInAccountId);
    }

    return new Promise((resolve) => {
      this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
        next: (aid) => resolve(aid ?? null),
        error: () => resolve(null),
      });
    });
  }

  feedActive(): boolean {
    return this.url.startsWith('/feed/');
  }

  friendsActive(): boolean {
    return this.url.startsWith('/friends');
  }

  chatActive(): boolean {
    return this.url.startsWith('/chat');
  }

  private handleIncomingChatMessage(
    message: { chatId?: string; sender?: { id?: string; nickName?: string } } | undefined,
  ): void {
    if (!message?.chatId || !this.loggedInAccountId) {
      return;
    }

    if (message.sender?.id === this.loggedInAccountId) {
      return;
    }

    const activeChatId = this.router.parseUrl(this.router.url).queryParams['chatId'] as string | undefined;
    const isViewingSameChat = this.chatActive() && activeChatId === message.chatId;
    if (isViewingSameChat) {
      return;
    }

    if (this.chatAlerts.some((item) => item.chatId === message.chatId)) {
      return;
    }

    this.chatAlerts = [
      {
        id: this.createAlertId(),
        message: `${message.sender?.nickName ?? 'Someone'} sent you a message`,
        chatId: message.chatId,
      },
      ...this.chatAlerts,
    ].slice(0, 3);
  }

  private createAlertId(): string {
    return `chat-alert-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  toggleAccountModal(): void {
    if (this.accountModalOpen) {
      this.accountModalOpen = false;
      return;
    }
    const id = this.loggedInAccountId;
    if (id) {
      this.accountModalOpen = true;
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          this.accountModalOpen = true;
        }
      },
    });
  }

  goBrand(event: Event): void {
    this.goFeed(event);
  }

  goFeed(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.loggedInAccountId;
    if (id) {
      void this.router.navigate(['/feed', id]);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/feed', aid]);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }

  goFriends(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.loggedInAccountId;
    if (id) {
      void this.router.navigate(['/friends']);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/friends']);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }

  goChat(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.loggedInAccountId;
    if (id) {
      void this.router.navigate(['/chat']);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/chat']);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }
}
