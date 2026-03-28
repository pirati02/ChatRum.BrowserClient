import { Component, OnInit } from '@angular/core';
import { AccountsService } from '../../services/accounts.service';
import { tap } from 'rxjs';
import { Account } from '../../models/account';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectedAccountService } from '../../services/selected-account.service';
import { MatSelectChange } from '@angular/material/select';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
})
export class AccountsComponent implements OnInit {
  protected accounts: Account[] = [];
  protected filteredAccounts: Account[] = [];
  sender?: Account;
  showNeedAccountHint = false;

  constructor(
    private accountsService: AccountsService,
    private router: Router,
    private route: ActivatedRoute,
    private selectedAccount: SelectedAccountService,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['needAccount'] === '1') {
        this.showNeedAccountHint = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { needAccount: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

    this.accountsService
      .loadAccounts()
      .pipe(
        tap((accounts) => {
          this.accounts = accounts;
          const storedId = this.selectedAccount.getSelectedAccountId();
          if (storedId) {
            const match = accounts.find((a) => a.id === storedId);
            if (match) {
              this.sender = match;
              this.filteredAccounts = accounts.filter((a) => a.id !== match.id);
            }
          }
        }),
      )
      .subscribe();
  }

  senderSelected($event: MatSelectChange) {
    this.sender = $event.value;
    this.selectedAccount.setSelectedAccountId(this.sender?.id ?? null);
    this.filteredAccounts = this.accounts.filter((account) => {
      return account.id !== $event.value.id;
    });
  }

  openAccountDetails(accountId: string) {
    this.router.navigate([`account-details/${accountId}`]).then();
  }

  compareAccounts(a: Account, b: Account): boolean {
    return a?.id === b?.id;
  }
}
