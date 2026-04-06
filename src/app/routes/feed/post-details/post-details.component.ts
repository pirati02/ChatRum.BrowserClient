import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize, tap } from 'rxjs';
import { FeedService } from '../../../services/feed.service';
import {
  CommentResponse,
  CommentThreadResponse,
  PostDetailsResponse,
} from '../../../models/post-details.response';
import { Account } from '../../../models/account';
import { AccountsService } from '../../../services/accounts.service';
import { Participant } from '../../../models/participant';
import { Reaction } from '../../../models/post.response';

@Component({
  selector: 'app-post-details',
  templateUrl: './post-details.component.html',
  styleUrls: ['./post-details.component.scss'],
})
export class PostDetailsComponent implements OnInit {
  loading = false;
  submitting = false;
  details?: PostDetailsResponse;
  commentForm!: FormGroup;
  replyForms: Record<string, FormGroup> = {};
  account?: Account;
  accountId = '';
  postId = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private feedService: FeedService,
    private accountsService: AccountsService,
  ) {}

  ngOnInit(): void {
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(2000)]],
    });

    this.activatedRoute.params.subscribe((params) => {
      this.accountId = params['accountId'] as string;
      this.postId = params['postId'] as string;
      this.accountsService
        .loadAccount(this.accountId)
        .pipe(
          tap((account) => {
            this.account = account;
            this.loadDetails();
          }),
        )
        .subscribe();
    });
  }

  loadDetails(): void {
    this.loading = true;
    this.feedService
      .getPostDetails(this.postId)
      .pipe(
        tap((details) => {
          this.details = details;
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe();
  }

  submitComment(): void {
    if (this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }

    const creator = this.getCurrentParticipant();
    if (!creator) {
      return;
    }

    this.submitting = true;
    this.feedService
      .addComment(this.postId, {
        creator,
        content: this.commentForm.value.content,
      })
      .pipe(
        tap(() => {
          this.commentForm.reset();
          this.loadDetails();
        }),
        finalize(() => (this.submitting = false)),
      )
      .subscribe();
  }

  submitReply(commentId: string): void {
    const replyForm = this.getReplyForm(commentId);
    if (replyForm.invalid) {
      replyForm.markAllAsTouched();
      return;
    }

    const creator = this.getCurrentParticipant();
    if (!creator) {
      return;
    }

    this.feedService
      .addReply(this.postId, commentId, {
        creator,
        content: replyForm.value.content,
      })
      .pipe(
        tap(() => {
          replyForm.reset();
          this.loadDetails();
        }),
      )
      .subscribe();
  }

  reactToComment(comment: CommentResponse): void {
    const actor = this.getCurrentParticipant();
    if (!actor || !this.details) {
      return;
    }

    const snapshot = structuredClone(this.details.comments);
    this.details.comments = this.toggleCommentReactionInTree(
      this.details.comments,
      comment.id,
      actor,
      0,
    );

    this.feedService
      .toggleCommentReaction(comment.id, { actor, reactionType: 0 })
      .subscribe({
        error: () => {
          if (this.details) {
            this.details.comments = snapshot;
          }
        },
      });
  }

  getReplyForm(commentId: string): FormGroup {
    if (!this.replyForms[commentId]) {
      this.replyForms[commentId] = this.fb.group({
        content: ['', [Validators.required, Validators.maxLength(2000)]],
      });
    }

    return this.replyForms[commentId];
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) {
      return '';
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateString));
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

  private toggleCommentReactionInTree(
    comments: CommentThreadResponse[],
    targetCommentId: string,
    actor: Participant,
    reactionType: number,
  ): CommentThreadResponse[] {
    return comments.map((thread) => {
      const updatedComment =
        thread.comment.id === targetCommentId
          ? {
              ...thread.comment,
              reactions: this.toggleReaction(thread.comment.reactions, actor, reactionType),
            }
          : thread.comment;

      return {
        ...thread,
        comment: updatedComment,
        replies: this.toggleCommentReactionInTree(
          thread.replies,
          targetCommentId,
          actor,
          reactionType,
        ),
      };
    });
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
