import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {tap} from "rxjs";
import {Account} from "../../models/account";
import {Router} from "@angular/router";
import {MatSelectChange} from "@angular/material/select";

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {

  protected accounts: Account[] = [];
  protected filteredAccounts: Account[] = [];
  sender?: Account;

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
