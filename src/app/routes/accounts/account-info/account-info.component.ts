import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {AccountsService} from "../../../services/accounts.service";
import {finalize, forkJoin, tap} from "rxjs";
import {Account} from "../../../models/account";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'app-account-info',
  templateUrl: './account-info.component.html',
  styleUrls: ['./account-info.component.scss']
})
export class AccountInfoComponent implements OnInit {

  account?: Account;
  verificationCode?: string;

  @Output() onAccount = new EventEmitter<Account>();

  constructor(
    private accountsService: AccountsService,
    private activatedRoute: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      const accountId = params['accountId'] as string;
      this.loadAccountDetails(accountId);
    });
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

  private loadAccountDetails(accountId: string) {
    forkJoin([
      this.accountsService.loadAccount(accountId)
        .pipe(
          tap(account => {
            this.account = account;
            this.onAccount.emit(account);
          })
        )
    ])
      .subscribe();
  }
}
