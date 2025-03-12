import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {catchError, of, tap} from "rxjs";
import {AccountResponse} from "../../models/account.response";
import {ActivatedRoute} from "@angular/router";
import {ConversationService} from "../../services/conversation.service";
import {MessageStatus} from "../../models/message.status";

export interface UiAccount extends AccountResponse {

}

@Component({
  selector: 'app-account-info',
  templateUrl: './account-info.component.html',
  styleUrls: ['./account-info.component.scss']
})
export class AccountInfoComponent implements OnInit {

  account?: UiAccount;
  account2?: string;

  constructor(
    private accountsService: AccountsService,
    private conversationService: ConversationService,
    private activatedRoute: ActivatedRoute
  ) {
  }

  ngOnInit() {
    this.activatedRoute.params.subscribe(params => {
      this.account2 = params['accountId2'];
      this.accountsService.loadAccount(params['accountId'])
        .pipe(
          tap(account => {
            this.account = account;

            this.conversationService.findConversation(this.account?.id!, this.account2!)
              .pipe(
                tap(res => {
                  this.conversationService.startConnection(this.account?.id!, res.conversationId!);
                }),
                catchError(error => {
                  console.error(error);
                  return of(null);
                })
              )
              .subscribe();
          })
        )
        .subscribe()
    });
    this.conversationService.conversationAppendMessage$.subscribe(message => {
      this.conversationService.updateMessageStatus(message?.message!, MessageStatus.Delivered);
    })
  }
}
