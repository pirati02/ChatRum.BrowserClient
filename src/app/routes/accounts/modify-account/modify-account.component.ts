import { Component, OnInit } from '@angular/core';
import { AccountsService } from '../../../services/accounts.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, tap } from 'rxjs';
import { Account } from '../../../models/account';

@Component({
  selector: 'app-modify-account',
  templateUrl: './modify-account.component.html',
  styleUrls: ['./modify-account.component.scss'],
})
export class ModifyAccountComponent implements OnInit {
  accountForm!: FormGroup;
  isSubmitting = false;
  account?: Account;

  constructor(
    private fb: FormBuilder,
    private accountsService: AccountsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.accountForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
    });

    this.activatedRoute.params.subscribe((params) => {
      const accountId = params['accountId'] as string;
      this.loadAccountDetails(accountId);
    });
  }

  onSubmit(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const account = this.accountForm.value;

    this.accountsService
      .updateAccount(this.account?.id!, account)
      .pipe()
      .subscribe({
        next: (accountId: string) => {
          this.isSubmitting = false;
          this.router.navigate([`account/${accountId}`]);
        },
        error: (err) => {
          console.error('Failed to update account', err);
          this.isSubmitting = false;
        },
      });
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }

  private loadAccountDetails(accountId: string) {
    forkJoin([
      this.accountsService.loadAccount(accountId).pipe(
        tap((account) => {
          this.account = account;

          this.accountForm.patchValue({
            userName: account.userName,
            firstName: account.firstName,
            lastName: account.lastName,
          });
        }),
      ),
    ]).subscribe();
  }
}
