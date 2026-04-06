import { Component, OnInit } from '@angular/core';
import { FeedService } from '../../services/feed.service';
import { finalize, tap } from 'rxjs';
import { AttachmentId, PostDocumentResponse } from '../../models/post.response';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountsService } from '../../services/accounts.service';
import { SelectedAccountService } from '../../services/selected-account.service';
import { Account } from '../../models/account';
import { Participant } from '../../models/participant';
import { Reaction } from '../../models/post.response';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { environment } from '../../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit {
  loading = false;
  postDocuments: PostDocumentResponse[] = [];
  account?: Account;
  private readonly gatewayBase = environment.gatewayUrl.replace(/\/$/, '');
  private readonly markdownCache = new Map<string, SafeHtml>();

  constructor(
    private feedService: FeedService,
    private accountsService: AccountsService,
    private activatedRoute: ActivatedRoute,
    private selectedAccount: SelectedAccountService,
    private router: Router,
    private authSession: AuthSessionService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params) => {
      const accountId = params['accountId'] as string;
      this.selectedAccount.setSelectedAccountId(accountId);
      this.accountsService
        .loadAccount(accountId)
        .pipe(
          tap((account) => {
            this.account = account;
            this.loadFeed();
          }),
        )
        .subscribe();
    });
  }

  private loadFeed(): void {
    this.loading = true;
    this.feedService
      .getShuffledFeed(this.account?.id!)
      .pipe(
        tap((posts) => {
          this.postDocuments = posts;
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe();
  }

  getAttachmentUrl(attachment: AttachmentId): string {
    const id = attachment?.guid;
    if (!id) {
      return '';
    }

    const url = `${this.gatewayBase}/feed/attachments/${id}`;
    const token = this.authSession.getAccessToken();
    if (!token) {
      return url;
    }

    return `${url}?access_token=${encodeURIComponent(token)}`;
  }

  onPostCreated(): void {
    this.loadFeed();
  }

  toSafeMarkdown(markdown: string | undefined): SafeHtml {
    const content = markdown ?? '';
    const cached = this.markdownCache.get(content);
    if (cached) {
      return cached;
    }

    const rendered = marked.parse(content, { breaks: true, async: false });
    const sanitized = DOMPurify.sanitize(rendered);
    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(sanitized);
    this.markdownCache.set(content, safeHtml);
    return safeHtml;
  }

  reactToPost(post: PostDocumentResponse): void {
    const actor = this.getCurrentParticipant();
    if (!actor) {
      return;
    }

    const previousReactions = [...post.reactions];
    post.reactions = this.toggleReaction(post.reactions, actor, 0);

    this.feedService
      .togglePostReaction(post.id, {
        actor,
        reactionType: 0,
      })
      .subscribe({
        error: () => {
          post.reactions = previousReactions;
        },
      });
  }

  openPostDetails(post: PostDocumentResponse): void {
    if (!this.account?.id) {
      return;
    }

    this.router.navigate(['/feed', this.account.id, 'post', post.id]);
  }

  /**
   * Friendly relative time for feed timestamps (uses creationDate from API).
   */
  formatPostTime(isoString: string | undefined): string {
    if (!isoString) {
      return '';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    let diffMs = Date.now() - date.getTime();
    if (diffMs < 0) {
      diffMs = 0;
    }
    const diffSec = Math.floor(diffMs / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (diffSec < 45) {
      return 'Just now';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return rtf.format(-diffMin, 'minute');
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return rtf.format(-diffHour, 'hour');
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      return rtf.format(-diffDay, 'day');
    }

    const dateOpts: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };
    if (date.getFullYear() !== new Date().getFullYear()) {
      dateOpts.year = 'numeric';
    }
    return new Intl.DateTimeFormat(undefined, dateOpts).format(date);
  }

  /**
   * Generate initials from first and last name
   */
  getAuthorInitials(firstName: string, lastName: string): string {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return firstInitial + lastInitial;
  }

  /**
   * TrackBy function for ngFor to improve performance
   */
  trackByPostId(index: number, post: PostDocumentResponse): any {
    return post.id || index;
  }

  /**
   * Scroll to create post section
   */
  scrollToCreatePost(): void {
    const createPostSection = document.querySelector('.create-post-section');
    if (createPostSection) {
      createPostSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      // Focus on the description input after scrolling
      setTimeout(() => {
        const descriptionInput = document.querySelector(
          '#description',
        ) as HTMLTextAreaElement;
        if (descriptionInput) {
          descriptionInput.focus();
        }
      }, 500);
    }
  }

  private getCurrentParticipant(): Participant | null {
    if (!this.account) {
      return null;
    }

    return {
      id: this.account.id,
      firstName: this.account.firstName,
      lastName: this.account.lastName,
      nickName: this.account.userName,
      isAdmin: false,
    };
  }

  private toggleReaction(
    reactions: Reaction[],
    actor: Participant,
    reactionType: number,
  ): Reaction[] {
    const existing = reactions.find((reaction) => reaction.actor.id === actor.id);
    if (!existing) {
      return [...reactions, { actor, reactionType }];
    }

    if (existing.reactionType === reactionType) {
      return reactions.filter((reaction) => reaction.actor.id !== actor.id);
    }

    return reactions.map((reaction) =>
      reaction.actor.id === actor.id ? { ...reaction, reactionType } : reaction,
    );
  }
}
