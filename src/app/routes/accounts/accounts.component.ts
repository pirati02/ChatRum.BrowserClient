import {ChangeDetectionStrategy, Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {tap} from "rxjs";
import {AccountResponse} from "../../models/account.response";
import {Router} from "@angular/router";
import {MatSelectChange} from "@angular/material/select";

export interface UiAccount extends AccountResponse {

}

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {

  protected accounts: UiAccount[] = [];
  protected filteredAccounts: UiAccount[] = [];
  sender?: UiAccount;

  constructor(
    private accountsService: AccountsService,
    private router: Router
  ) {
  }

  ngOnInit() {
    this.accountsService.loadAccounts()
      .pipe(
        tap(accounts => {
          this.accounts = accounts;
        })
      )
      .subscribe()
  }

  senderSelected($event: MatSelectChange) {
    this.sender = $event.value;
    this.filteredAccounts = this.accounts.filter(account => {
      return account.id !== $event.value.id;
    })
  }

  openAccountDetails(accountId: string) {
    this.router.navigate([`account-info/${accountId}`]).then();
  }
}
