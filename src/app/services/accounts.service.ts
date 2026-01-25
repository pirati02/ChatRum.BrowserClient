import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
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
      .get<Account[]>(this.baseUrl)
  }

  loadAccount(id: string) {
    return this.httpClient
      .get<Account>(this.baseUrl + '/' + id)
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

  updateAccount(accountId: string, account: Account) {
    return this.httpClient
      .put<string>(this.baseUrl + '/' + accountId, account)
  }

  /**
   * Register public key for E2E encryption
   */
  registerPublicKey(accountId: string, publicKey: string) {
    return this.httpClient
      .put<boolean>(this.baseUrl + '/' + accountId + '/public-key', { publicKey })
  }

  /**
   * Get public key for an account
   */
  getPublicKey(accountId: string) {
    return this.httpClient
      .get<{ publicKey: string }>(this.baseUrl + '/' + accountId + '/public-key')
  }
}
