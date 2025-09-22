import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {finalize, forkJoin, mergeMap, tap} from "rxjs";
import {Account} from "../../models/account";
import {ActivatedRoute, Router} from "@angular/router";
import {ChatService} from "../../services/chat.service";
import {MessageStatus} from "../../models/message.status";
import {FriendshipService} from "../../services/frienship.service";
import {PeerResponse} from "../../models/peer.response";
import {LastChatResponse} from "../../models/last-chat.response";
import {LastestMessage} from "../../models/latest-message.response";

export interface UiAccount extends Account {

}

export interface PeerExtended extends PeerResponse {
  chat: LastChatResponse | null
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
    private chatService: ChatService,
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
    this.chatService.chatAppendMessage$.subscribe(message => {
      if (message) {
        this.chatService.updateMessageStatus(message?.message!, MessageStatus.Delivered);
        const conversation = this.friends.find(item => item.chat?.chatId === message?.message.chatId);
        if (conversation?.chat) {
          conversation.chat.message = <LastestMessage>{
            content: message?.message.content,
            sender: message?.message.sender,
            chatId: message?.message.chatId,
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

            this.friends = friends.map(friend => {
              return {
                ...friend,
                chat: null
              }
            })

            return forkJoin([
              this.chatService.findTop10Conversation(accountId, friendIds)
                .pipe(
                  mergeMap(chats => {
                    chats.forEach(_ => {
                      this.chatService.startConnection(this.account?.id!);
                    });
                    this.friends = friends.map(friend => {
                      return {
                        ...friend,
                        chat: this.latestMessage(chats, friend.peerId)
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

  latestMessage(chats: LastChatResponse[], peerId: string): LastChatResponse {
    return chats.find(item => item.participantIds?.includes(peerId))!;
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
