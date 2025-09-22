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

export interface PeerExtended extends PeerResponse {
  checked: boolean
}

@Component({
  selector: 'app-account-info',
  templateUrl: './account-info.component.html',
  styleUrls: ['./account-info.component.scss']
})
export class AccountInfoComponent implements OnInit {

  account?: Account;
  randomAccounts: Account[] = [];
  friends: PeerExtended[] = [];
  receivedFriendRequests: PeerResponse[] = [];
  sentFriendRequests: PeerResponse[] = [];
  verificationCode?: string;

  chats: LastChatResponse[] = [];

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
        const chat = this.chats.find(item => item?.chatId === message?.message.chatId);
        if (chat) {
          chat.message = <LastestMessage>{
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
                chat: null,
                checked: false
              }
            })

            return forkJoin([
              this.chatService.findTop10Conversation(accountId, friendIds)
                .pipe(
                  mergeMap(chats => {
                    chats.forEach(_ => {
                      this.chatService.startConnection(this.account?.id!);
                    });
                    this.chats = chats;
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

  startGroupChat(overrideExisting: boolean = false){
    const selectedFriends = this.friends.filter(item => item.checked)
      .map(friend => <Account>{
        id: friend.peerId,
        firstName: friend.firstName,
        lastName: friend.lastName,
        userName: friend.userName,
        isVerified: true //accepted friend requests are always verified
      });
    this.router.navigate(['chat'], {
      queryParams: {
        receivers: JSON.stringify(selectedFriends),
        me: JSON.stringify(this.account),
        isGroupChat: true,
        overrideExisting
      }
    }).then();
  }

  openChat(chat: LastChatResponse){
    const selectedFriends = chat.participants
      .map(friend => <Account>{
        id: friend.id,
        firstName: friend.firstName,
        lastName: friend.lastName,
        userName: friend.nickName,
        isVerified: true //accepted friend requests are always verified
      });

    this.router.navigate(['chat'], {
      queryParams: {
        chatId: chat.chatId,
        me: JSON.stringify(this.account),
        receivers: JSON.stringify(selectedFriends),
        isGroupChat: chat.isGroupChat
      }
    })
  }
}
