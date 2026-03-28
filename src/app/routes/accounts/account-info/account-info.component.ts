import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AccountsService } from '../../../services/accounts.service';
import { SelectedAccountService } from '../../../services/selected-account.service';
import { finalize, forkJoin, tap } from 'rxjs';
import { Account } from '../../../models/account';

@Component({
  selector: 'app-account-info',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './account-info.component.html',
  styleUrl: './account-info.component.scss',
})
export class AccountInfoComponent implements OnChanges {
  account?: Account;
  verificationCode?: string;

  @Input() accountId: string | null = null;

  @Output() onAccount = new EventEmitter<Account>();

  constructor(
    private accountsService: AccountsService,
    private router: Router,
    private selectedAccount: SelectedAccountService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId']) {
      this.tryLoadFromInput();
    }
  }

  private tryLoadFromInput(): void {
    const id = this.accountId;
    if (id) {
      this.loadAccountDetails(id);
    } else {
      this.account = undefined;
    }
  }

  verifyAccount() {
    this.accountsService
      .verify(this.verificationCode!, this.account?.id!)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        }),
      )
      .subscribe();
  }

  resendCode() {
    this.accountsService
      .resendCode(this.account?.id!)
      .pipe(
        finalize(() => {
          this.loadAccountDetails(this.account?.id!);
        }),
      )
      .subscribe();
  }

  modifyAccount() {
    this.router.navigate([`account/${this.account?.id}/modify`]);
  }

  private loadAccountDetails(accountId: string) {
    forkJoin([
      this.accountsService.loadAccount(accountId).pipe(
        tap((account) => {
          this.account = account;
          this.selectedAccount.setSelectedAccountId(account.id);
          this.onAccount.emit(account);
        }),
      ),
    ]).subscribe();
  }
}
