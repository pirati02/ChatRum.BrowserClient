import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {AccountsService} from "../../../services/accounts.service";
import {finalize, forkJoin, map, tap} from "rxjs";
import {Account} from "../../../models/account";
import {ActivatedRoute, Router} from "@angular/router";
import {PeerResponse} from "../../../models/peer.response";
import {FriendshipService} from "../../../services/frienship.service";

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
    this.friendshipService.sendFriendRequest(this.account?.id!, account.id)
      .pipe(
        finalize(() => {
          this.loadAccountFriends(this.account?.id!);
        })
      )
      .subscribe()
  }

  unfriend(friend: PeerResponse) {
    this.friendshipService.unfriendRequest(this.account?.id!, friend.peerId)
      .pipe(
        finalize(() => {
          this.loadAccountFriends(this.account?.id!);
        })
      )
      .subscribe();
  }

  acceptFriend(friend: PeerResponse) {
    this.friendshipService.acceptFriendRequest(this.account?.id!, friend.peerId)
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
      this.friendshipService.getFriendRequests(accountId)
        .pipe(
          tap(friends => {
            this.receivedFriendRequests = friends;
          })
        ),
      this.friendshipService.getFriendRequestsISent(accountId)
        .pipe(
          tap(friends => {
            this.sentFriendRequests = friends;
          })
        ),
      this.friendshipService.getFriends(accountId)
        .pipe(
          map(friends => {
            const friendIds = friends
              .filter((_, index) => index <= 10)
              .map(item => item.peerId);

            this.friends = friends.map(friend => {
              return {
                ...friend,
                chat: null,
                checked: false
              }
            });

            this.onFriends.emit(this.friends);
          })
        )
    ])
      .subscribe();
  }
}
