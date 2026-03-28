import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AccountsService } from '../../../services/accounts.service';
import { delay, finalize, forkJoin, Subscription, tap } from 'rxjs';
import { Account } from '../../../models/account';
import { ActivatedRoute, Router } from '@angular/router';
import { PeerResponse } from '../../../models/peer.response';
import { FriendshipService } from '../../../services/frienship.service';
import { Peer } from '../../../models/peer';

export interface PeerExtended extends PeerResponse {
  checked: boolean;
}

@Component({
  selector: 'app-account-friends',
  templateUrl: './account-friends.component.html',
  styleUrls: ['./account-friends.component.scss'],
})
export class AccountFriendsComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() account?: Account;
  @Output() onFriends = new EventEmitter<PeerExtended[]>();

  friends: PeerExtended[] = [];
  randomAccounts: Account[] = [];
  receivedFriendRequests: PeerResponse[] = [];
  sentFriendRequests: PeerResponse[] = [];

  private subscriptions: Subscription[] = [];
  /** Last account id we started SignalR / graph load for (route param or input). */
  private activeAccountId: string | undefined;

  constructor(
    private accountsService: AccountsService,
    private friendshipService: FriendshipService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const routeSub = this.activatedRoute.paramMap.subscribe(() =>
      this.applyResolvedAccountId(),
    );
    this.subscriptions.push(routeSub);

    this.applyResolvedAccountId();
    this.startListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['account']) {
      this.applyResolvedAccountId();
    }
  }

  ngOnDestroy() {
    this.friendshipService.stopConnection();
    this.activeAccountId = undefined;
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /** Prefer route `account-details/:accountId`; otherwise `/friends` passes `[account]`. */
  private resolveAccountId(): string | undefined {
    const fromRoute = this.activatedRoute.snapshot.paramMap.get('accountId');
    return fromRoute ?? this.account?.id;
  }

  private applyResolvedAccountId(): void {
    const accountId = this.resolveAccountId();
    if (!accountId) {
      if (this.activeAccountId) {
        this.friendshipService.stopConnection();
        this.activeAccountId = undefined;
      }
      return;
    }
    if (accountId === this.activeAccountId) {
      return;
    }
    if (this.activeAccountId) {
      this.friendshipService.stopConnection();
    }
    this.activeAccountId = accountId;
    this.loadAccountFriendsGraph(accountId);
    this.friendshipService.startConnection(accountId);
  }

  private startListeners() {
    // Listen for incoming friend requests
    const receivedSub = this.friendshipService.friendRequestReceived$.subscribe(
      (data) => {
        if (!data) return;

        this.refreshFriendRequests(this.account!.id, data.fromPeerId);
      },
    );
    this.subscriptions.push(receivedSub);

    // Listen for accepted friend requests
    const acceptedSub = this.friendshipService.friendRequestAccepted$.subscribe(
      (data) => {
        if (!data) return;

        this.refreshFriendsOnAccept(this.account!.id, data.fromPeerId);
      },
    );
    this.subscriptions.push(acceptedSub);
  }

  startPrivateChat($event: PeerExtended): void {
    this.accountsService
      .loadAccount($event.peerId)
      .pipe(
        tap((receiver) => {
          this.router
            .navigate(['chat'], {
              queryParams: {
                receivers: JSON.stringify([receiver]),
                newChat: $event.checked,
                isGroupChat: false,
              },
            })
            .then();
        }),
      )
      .subscribe();
  }

  sendFriendRequest(account: Account) {
    const peer2: Peer = {
      peerId: account.id,
      userName: account.userName,
    };
    this.friendshipService
      .sendFriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriendsGraph(this.account?.id!);
        }),
      )
      .subscribe();
  }

  unfriend(friend: PeerResponse) {
    const peer2: Peer = {
      peerId: friend.peerId,
      userName: friend.userName,
    };
    this.friendshipService
      .unfriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriendsGraph(this.account?.id!);
        }),
      )
      .subscribe();
  }

  acceptFriend(friend: PeerResponse) {
    const peer2: Peer = {
      peerId: friend.peerId,
      userName: friend.userName,
    };
    this.friendshipService
      .acceptFriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriendsGraph(this.account?.id!);
        }),
      )
      .subscribe();
  }

  startGroupChat(overrideExisting: boolean = false) {
    const selectedFriends = this.friends
      .filter((item) => item.checked)
      .map(
        (friend) =>
          <Account>{
            id: friend.peerId,
            firstName: friend.firstName,
            lastName: friend.lastName,
            userName: friend.userName,
            isVerified: true, //accepted friend requests are always verified
          },
      );
    const receiversOnly = selectedFriends.filter(
      (a) => a.id !== this.account?.id,
    );
    if (receiversOnly.length > 1) {
      this.router
        .navigate(['chat'], {
          queryParams: {
            receivers: JSON.stringify(receiversOnly),
            overrideExisting,
          },
        })
        .then();
    }
  }

  private refreshFriendRequests(accountId: string, fromPeer: Peer) {
    this.friendshipService
      .getFriendRequests(accountId)
      .pipe(
        delay(2500),
        tap((receivedRequests) => {
          this.receivedFriendRequests = receivedRequests;

          // Remove the peer from randomAccounts if they exist there
          this.randomAccounts = this.randomAccounts.filter(
            (account) => account.id !== fromPeer.peerId,
          );
        }),
      )
      .subscribe();
  }

  private refreshFriendsOnAccept(accountId: string, fromPeer: Peer) {
    this.friendshipService
      .getFriends(accountId)
      .pipe(
        delay(2500),
        tap((friends) => {
          this.friends = friends.map((friend) => ({
            ...friend,
            chat: null,
            checked: false,
          }));

          // Remove the accepted peer from receivedFriendRequests
          this.receivedFriendRequests = this.receivedFriendRequests.filter(
            (request) => request.peerId !== fromPeer.peerId,
          );

          this.onFriends.emit(this.friends);
        }),
      )
      .subscribe();
  }

  private loadAccountFriendsGraph(accountId: string) {
    forkJoin([
      this.friendshipService.getFriendRequests(accountId),
      this.friendshipService.getFriendRequestsISent(accountId),
      this.friendshipService.getFriends(accountId),
      this.accountsService.loadAccounts(),
    ])
      .pipe(
        tap(([receivedRequests, sentRequests, friends, allAccounts]) => {
          // Update component properties
          this.receivedFriendRequests = receivedRequests;
          this.sentFriendRequests = sentRequests;

          this.friends = friends.map((friend) => ({
            ...friend,
            chat: null,
            checked: false,
          }));

          // Get all user IDs that should be filtered out
          const currentUserId = accountId;
          const friendIds = friends.map((f) => f.peerId);
          const receivedRequestIds = receivedRequests.map((r) => r.peerId);
          const sentRequestIds = sentRequests.map((s) => s.peerId);

          const excludedIds = new Set([
            currentUserId,
            ...friendIds,
            ...receivedRequestIds,
            ...sentRequestIds,
          ]);

          // Filter accounts to show only those not already connected
          this.randomAccounts = allAccounts.filter(
            (account) => !excludedIds.has(account.id),
          );

          this.onFriends.emit(this.friends);
        }),
      )
      .subscribe();
  }

  private get peer1(): Peer {
    return <Peer>{
      peerId: this.account?.id!,
      userName: this.account?.userName,
    };
  }
}
