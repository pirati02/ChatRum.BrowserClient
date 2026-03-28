import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsService } from '../../services/accounts.service';
import { SelectedAccountService } from '../../services/selected-account.service';

@Component({
  selector: 'app-home-redirect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-redirect.component.html',
  styleUrl: './home-redirect.component.scss',
})
export class HomeRedirectComponent implements OnInit {
  noAccounts = false;

  constructor(
    private accounts: AccountsService,
    private selected: SelectedAccountService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.accounts.ensureDefaultAccountId(this.selected).subscribe({
      next: (id) => {
        if (!id) {
          this.noAccounts = true;
          return;
        }
        void this.router.navigate(['/feed', id]);
      },
      error: () => {
        void this.router.navigate(['/login']);
      },
    });
  }
}
