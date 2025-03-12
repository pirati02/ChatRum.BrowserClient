import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {UiAccount} from "../routes/accounts/accounts.component";

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
}
