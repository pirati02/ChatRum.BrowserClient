import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd,
} from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ChatService } from '../services/chat.service';
import { FriendshipService } from '../services/frienship.service';
import { SelectedAccountService } from '../services/selected-account.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  selectedAccountId: string | null = null;
  url = '';
  private sub?: Subscription;
  private routerSub?: Subscription;

  constructor(
    private selectedAccount: SelectedAccountService,
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

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  goFeed(event: Event): void {
    event.preventDefault();
    if (!this.selectedAccountId) {
      void this.router.navigate(['/'], { queryParams: { needAccount: '1' } });
      this.closeMobileMenu();
      return;
    }
    void this.router.navigate(['/feed', this.selectedAccountId]);
    this.closeMobileMenu();
  }

  goFriends(event: Event): void {
    event.preventDefault();
    if (!this.selectedAccountId) {
      void this.router.navigate(['/'], { queryParams: { needAccount: '1' } });
      this.closeMobileMenu();
      return;
    }
    void this.router.navigate(['/friends']);
    this.closeMobileMenu();
  }
}
