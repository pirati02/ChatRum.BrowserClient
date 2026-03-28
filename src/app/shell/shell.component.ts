import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { AccountsService } from '../services/accounts.service';
import { ChatService } from '../services/chat.service';
import { FriendshipService } from '../services/frienship.service';
import { SelectedAccountService } from '../services/selected-account.service';
import { InlineModalComponent } from '../shared/inline-modal/inline-modal.component';
import { AccountInfoComponent } from '../routes/accounts/account-info/account-info.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    InlineModalComponent,
    AccountInfoComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  accountModalOpen = false;
  selectedAccountId: string | null = null;
  url = '';
  private sub?: Subscription;
  private routerSub?: Subscription;

  constructor(
    private selectedAccount: SelectedAccountService,
    private accounts: AccountsService,
    private router: Router,
    private auth: AuthService,
    private chat: ChatService,
    private friendship: FriendshipService,
  ) {}

  ngOnInit(): void {
    this.url = this.router.url;
    this.sub = this.selectedAccount.selectedAccountId().subscribe((id) => {
      this.selectedAccountId = id;
    });
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url = e.urlAfterRedirects;
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  logout(): void {
    this.chat.stopConnection();
    this.friendship.stopConnection();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  feedActive(): boolean {
    return this.url.startsWith('/feed/');
  }

  friendsActive(): boolean {
    return this.url.startsWith('/friends');
  }

  chatActive(): boolean {
    return this.url.startsWith('/chat');
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  toggleAccountModal(): void {
    if (this.accountModalOpen) {
      this.accountModalOpen = false;
      return;
    }
    const id = this.selectedAccountId;
    if (id) {
      this.accountModalOpen = true;
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          this.accountModalOpen = true;
        }
      },
    });
  }

  goBrand(event: Event): void {
    this.goFeed(event);
  }

  goFeed(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.selectedAccountId;
    if (id) {
      void this.router.navigate(['/feed', id]);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/feed', aid]);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }

  goFriends(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.selectedAccountId;
    if (id) {
      void this.router.navigate(['/friends']);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/friends']);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }

  goChat(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    const id = this.selectedAccountId;
    if (id) {
      void this.router.navigate(['/chat']);
      return;
    }
    this.accounts.ensureDefaultAccountId(this.selectedAccount).subscribe({
      next: (aid) => {
        if (aid) {
          void this.router.navigate(['/chat']);
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => void this.router.navigate(['/']),
    });
  }
}
