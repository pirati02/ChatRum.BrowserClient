import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {finalize, forkJoin, mergeMap, tap} from "rxjs";
import {AccountResponse} from "../../models/account.response";
import {ActivatedRoute, Router} from "@angular/router";
import {ConversationService} from "../../services/conversation.service";
import {MessageStatus} from "../../models/message.status";
import {FriendshipService} from "../../services/frienship.service";
import {PeerResponse} from "../../models/peer.response";
import {LastConversationResponse} from "../../models/last-conversation.response";
import {LastestMessageResponse} from "../../models/latest-message.response";

export interface UiAccount extends AccountResponse {

}

export interface PeerExtended extends PeerResponse {
  conversation: LastConversationResponse
}

@Component({
  selector: 'app-account-info',
  templateUrl: './account-info.component.html',
  styleUrls: ['./account-info.component.scss']
})
export class AccountInfoComponent implements OnInit {

  account?: UiAccount;
  randomAccounts: UiAccount[] = [];
  friends: PeerExtended[] = [];
  receivedFriendRequests: PeerResponse[] = [];
  sentFriendRequests: PeerResponse[] = [];
  verificationCode?: string;

  constructor(
    private accountsService: AccountsService,
    private conversationService: ConversationService,
    private friendshipService: FriendshipService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {

      const accountId = params['accountId'] as string;
      this.loadAccountDetails(accountId);
    });
    this.conversationService.conversationAppendMessage$.subscribe(message => {
      if (message) {
        this.conversationService.updateMessageStatus(message?.message!, MessageStatus.Delivered);
        const conversation = this.friends.find(item => item.conversation.conversationId === message?.message.conversationId);
        if (conversation) {
          conversation.conversation.message = <LastestMessageResponse>{
            content: message?.message.content,
            senderId: message?.message.senderId,
            conversationId: message?.message.conversationId,
            messageId: message?.message.messageId
          };
        }
      }
    });
  }

  private loadAccountDetails(accountId: string) {
    forkJoin([
      this.accountsService.loadAccount(accountId)
        .pipe(
          tap(account => {
            this.account = account;
          })
        ),
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
          mergeMap(friends => {
            const friendIds = friends
              .filter((_, index) => index <= 10)
              .map(item => item.peerId);
            return forkJoin([
              this.conversationService.findTop10Conversation(accountId, friendIds)
                .pipe(
                  mergeMap(conversations => {
                    conversations.forEach(_ => {
                      this.conversationService.startConnection(this.account?.id!);
                    });
                    this.friends = friends.map(friend => {
                      return {
                        ...friend,
                        conversation: this.latestMessage(conversations, friend.peerId)
                      }
                    })
                    return this.accountsService.loadAccounts()
                      .pipe(
                        tap(accounts => {
                          const accountsToOmit = [
                            ...this.friends.map(account => account.peerId),
                            ...this.receivedFriendRequests.map(peer => peer.peerId),
                            ...this.sentFriendRequests.map(peer => peer.peerId),
                            this.account?.id
                          ];
                          this.randomAccounts = accounts.filter(account => !accountsToOmit.includes(account.id));
                        })
                      )
                  })
                )
            ])
          })
        )
    ])
      .subscribe();
  }

  latestMessage(conversations: LastConversationResponse[], peerId: string): LastConversationResponse {
    return conversations.find(item => item.participantIds.includes(peerId))!;
  }

  selectParticipants($event: PeerResponse): void {
    this.accountsService.loadAccount($event.peerId)
      .pipe(
        tap(receiver => {
          this.router.navigate(['conversation'], {
            queryParams: {
              receiver: JSON.stringify(receiver),
              sender: JSON.stringify(this.account)
            }
          }).then();
        }))
      .subscribe();
  }

  sendFriendRequest(account: UiAccount) {
    this.friendshipService.sendFriendRequest(this.account?.id!, account.id)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        })
      )
      .subscribe()
  }

  unfriend(friend: PeerResponse) {
    this.friendshipService.unfriendRequest(this.account?.id!, friend.peerId)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        })
      )
      .subscribe();
  }

  acceptFriend(friend: PeerResponse) {
    this.friendshipService.acceptFriendRequest(this.account?.id!, friend.peerId)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        })
      )
      .subscribe();
  }

  verifyAccount(){
    this.accountsService.verify(this.verificationCode!, this.account?.id!)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        })
      )
      .subscribe()
  }

  resendCode(){
    this.accountsService.resendCode(this.account?.id!)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        })
      )
      .subscribe()
  }
}
