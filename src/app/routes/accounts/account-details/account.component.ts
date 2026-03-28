import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Account } from '../../../models/account';
import { LastChatResponse } from '../../../models/last-chat.response';
import { ChatService } from '../../../services/chat.service';
import { MessageStatus } from '../../../models/message.status';
import { LastestMessage } from '../../../models/latest-message.response';
import { PeerExtended } from '../account-friends/account-friends.component';
import { AccountsService } from '../../../services/accounts.service';
import { SelectedAccountService } from '../../../services/selected-account.service';
import { EMPTY, Subscription, switchMap } from 'rxjs';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit, OnDestroy {
  account?: Account;
  friends: PeerExtended[] = [];
  chats: LastChatResponse[] = [];

  private accountRouteSub?: Subscription;

  constructor(
    private activatedRoute: ActivatedRoute,
    private accountsService: AccountsService,
    private selectedAccount: SelectedAccountService,
    private chatService: ChatService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.accountRouteSub = this.activatedRoute.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('accountId');
          if (!id) {
            return EMPTY;
          }
          return this.accountsService.loadAccount(id);
        }),
      )
      .subscribe((account) => {
        this.account = account;
        this.selectedAccount.setSelectedAccountId(account.id);
        this.chatService.findTop10Conversation(account.id).subscribe((chats) => {
          this.chats = chats;
        });
        this.chatService.startConnection(account.id);
      });

    this.chatService.chatAppendMessage$.subscribe((message) => {
      if (message) {
        this.chatService.updateMessageStatus(
          message?.message!,
          MessageStatus.Delivered,
        );
        const chat = this.chats.find(
          (item) => item?.chatId === message?.message.chatId,
        );
        if (chat) {
          chat.message = <LastestMessage>{
            content: message?.message.content,
            sender: message?.message.sender,
            chatId: message?.message.chatId,
            messageId: message?.message.messageId,
          };
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.accountRouteSub?.unsubscribe();
  }

  openChat(chat: LastChatResponse) {
    const selectedFriends = chat.participants
      .filter((p) => p.id !== this.account?.id)
      .map(
        (friend) =>
          <Account>{
            id: friend.id,
            firstName: friend.firstName,
            lastName: friend.lastName,
            userName: friend.nickName,
            isVerified: true, //accepted friend requests are always verified
          },
      );

    this.router
      .navigate(['chat'], {
        queryParams: {
          chatId: chat.chatId,
          receivers: JSON.stringify(selectedFriends),
        },
      })
      .then();
  }
}
