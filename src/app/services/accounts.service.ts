import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {UiAccount} from "../routes/accounts/accounts.component";
import {Account} from "../models/account";

@Injectable({
  providedIn: 'root'
})
export class AccountsService{

  constructor(
    @Inject('ACCOUNTS_BASE_URL') private baseUrl: string,
    private httpClient: HttpClient
  ) {

  }

  loadAccounts() {
    return this.httpClient
      .get<UiAccount[]>(this.baseUrl)
  }

  loadAccount(id: string) {
    return this.httpClient
      .get<UiAccount>(this.baseUrl + '/' + id)
  }

  createAccount(account: Account) {
    return this.httpClient
      .post<string>(this.baseUrl, account)
  }

  verify(code: string, accountId: string){
    return this.httpClient
      .put<boolean>(this.baseUrl + '/activate',{
        code,
        accountId
      })
  }

  resendCode(accountId: string){
    return this.httpClient
      .patch<boolean>(this.baseUrl + '/' + accountId + '/resend-code',{})
  }
}
