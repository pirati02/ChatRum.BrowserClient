import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Account } from '../models/account';
import { SelectedAccountService } from './selected-account.service';

@Injectable({
  providedIn: 'root',
})
export class AccountsService {
  constructor(
    @Inject('ACCOUNTS_BASE_URL') private baseUrl: string,
    private httpClient: HttpClient,
  ) {}

  loadAccounts() {
    return this.httpClient.get<Account[]>(this.baseUrl);
  }

  /** Picks stored account if still valid, otherwise the first account; updates selection. */
  ensureDefaultAccountId(
    selected: SelectedAccountService,
  ): Observable<string | null> {
    return this.loadAccounts().pipe(
      map((accounts) => {
        if (!accounts.length) {
          return null;
        }
        let id = selected.getSelectedAccountId();
        if (!id || !accounts.some((a) => a.id === id)) {
          id = accounts[0].id;
          selected.setSelectedAccountId(id);
        }
        return id;
      }),
    );
  }

  loadAccount(id: string) {
    return this.httpClient.get<Account>(this.baseUrl + '/' + id);
  }

  createAccount(account: Account) {
    return this.httpClient.post<string>(this.baseUrl, account);
  }

  verify(code: string, accountId: string) {
    return this.httpClient.put<boolean>(this.baseUrl + '/activate', {
      code,
      accountId,
    });
  }

  resendCode(accountId: string) {
    return this.httpClient.patch<boolean>(
      this.baseUrl + '/' + accountId + '/resend-code',
      {},
    );
  }

  updateAccount(accountId: string, account: Account) {
    return this.httpClient.put<string>(this.baseUrl + '/' + accountId, account);
  }
}
