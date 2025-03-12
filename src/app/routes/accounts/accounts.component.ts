import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {tap} from "rxjs";
import {AccountResponse} from "../../models/account.response";
import {Router} from "@angular/router";
import {MatOptionSelectionChange} from "@angular/material/core";
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
  receiver?: UiAccount;
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

  selectParticipants() {
    this.router.navigate(['conversation'], {
      queryParams: {
        receiver: JSON.stringify(this.receiver),
        sender: JSON.stringify(this.sender)
      }
    }).then();
  }

  receiverSelected($event: MatSelectChange) {
    this.receiver = $event.value;
  }

  senderSelected($event: MatSelectChange) {
    this.sender = $event.value;
  }
}
