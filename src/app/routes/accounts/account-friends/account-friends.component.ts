import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {AccountsService} from "../../../services/accounts.service";
import {finalize, forkJoin, map, tap} from "rxjs";
import {Account} from "../../../models/account";
import {ActivatedRoute, Router} from "@angular/router";
import {PeerResponse} from "../../../models/peer.response";
import {FriendshipService} from "../../../services/frienship.service";
import { Peer } from "../../../models/peer";

export interface PeerExtended extends PeerResponse {
  checked: boolean
}


@Component({
  selector: 'app-account-friends',
  templateUrl: './account-friends.component.html',
  styleUrls: ['./account-friends.component.scss']
})
export class AccountFriendsComponent implements OnInit {

  @Input() account?: Account;
  @Output() onFriends = new EventEmitter<PeerExtended[]>();

  friends: PeerExtended[] = [];
  randomAccounts: Account[] = [];
  receivedFriendRequests: PeerResponse[] = [];
  sentFriendRequests: PeerResponse[] = [];

  constructor(
    private accountsService: AccountsService,
    private friendshipService: FriendshipService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
  }

  ngOnInit() {
    this.activatedRoute.params.subscribe(params => {
      const accountId = params['accountId'] as string;
      this.loadAccountFriends(accountId);
    });
  }

  startPrivateChat($event: PeerResponse): void {
    this.accountsService.loadAccount($event.peerId)
      .pipe(
        tap(receiver => {
          this.router.navigate(['chat'], {
            queryParams: {
              receivers: JSON.stringify([receiver]),
              me: JSON.stringify(this.account),
              isGroupChat: false
            }
          }).then();
        }))
      .subscribe();
  }

  sendFriendRequest(account: Account) {
    const peer2: Peer = {
      peerId:  account.id,
      userName: account.userName
    };
    this.friendshipService.sendFriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriends(this.account?.id!);
        })
      )
      .subscribe()
  }

  unfriend(friend: PeerResponse) {
    const peer2: Peer = {
      peerId:  friend.peerId,
      userName: friend.userName
    };
    this.friendshipService.unfriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriends(this.account?.id!);
        })
      )
      .subscribe();
  }

  acceptFriend(friend: PeerResponse) {
    const peer2: Peer = {
      peerId:  friend.peerId,
      userName: friend.userName
    };
    this.friendshipService.acceptFriendRequest(this.peer1, peer2)
      .pipe(
        finalize(() => {
          this.loadAccountFriends(this.account?.id!);
        })
      )
      .subscribe();
  }


  startGroupChat(overrideExisting: boolean = false) {
    const selectedFriends = this.friends.filter(item => item.checked)
      .map(friend => <Account>{
        id: friend.peerId,
        firstName: friend.firstName,
        lastName: friend.lastName,
        userName: friend.userName,
        isVerified: true //accepted friend requests are always verified
      });
    if (selectedFriends.length > 1) {
      this.router.navigate(['chat'], {
        queryParams: {
          receivers: JSON.stringify(selectedFriends),
          me: JSON.stringify(this.account),
          overrideExisting
        }
      }).then();
    }
  }

  private loadAccountFriends(accountId: string) {
    forkJoin([
      this.friendshipService.getFriendRequests(accountId),
      this.friendshipService.getFriendRequestsISent(accountId),
      this.friendshipService.getFriends(accountId),
      this.accountsService.loadAccounts()
    ])
      .pipe(
        tap(([receivedRequests, sentRequests, friends, allAccounts]) => {
          // Update component properties
          this.receivedFriendRequests = receivedRequests;
          this.sentFriendRequests = sentRequests;
          
          this.friends = friends.map(friend => ({
            ...friend,
            chat: null,
            checked: false
          }));

          // Get all user IDs that should be filtered out
          const currentUserId = accountId;
          const friendIds = friends.map(f => f.peerId);
          const receivedRequestIds = receivedRequests.map(r => r.peerId);
          const sentRequestIds = sentRequests.map(s => s.peerId);
          
          const excludedIds = new Set([
            currentUserId,
            ...friendIds,
            ...receivedRequestIds,
            ...sentRequestIds
          ]);

          // Filter accounts to show only those not already connected
          this.randomAccounts = allAccounts.filter(account => 
            !excludedIds.has(account.id)
          );

          this.onFriends.emit(this.friends);
        })
      )
      .subscribe();
  }

  private get peer1(): Peer {
    return <Peer> {
      peerId: this.account?.id!,
      userName: this.account?.userName
    }
  }
}
