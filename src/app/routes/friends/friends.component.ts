import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Account } from '../../models/account';
import { AccountsService } from '../../services/accounts.service';
import { SelectedAccountService } from '../../services/selected-account.service';
import { PeerExtended } from '../accounts/account-friends/account-friends.component';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss'],
})
export class FriendsComponent implements OnInit {
  account?: Account;
  loading = true;
  friends: PeerExtended[] = [];

  constructor(
    private accountsService: AccountsService,
    private selectedAccount: SelectedAccountService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.selectedAccount.getSelectedAccountId();
    if (!id) {
      this.loading = false;
      void this.router.navigate(['/'], { queryParams: { needAccount: '1' } });
      return;
    }
    this.accountsService
      .loadAccount(id)
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (account) => {
          this.account = account;
        },
        error: () => {
          void this.router.navigate(['/']);
        },
      });
  }
}
