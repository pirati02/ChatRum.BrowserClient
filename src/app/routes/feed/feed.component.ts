import {Component, OnInit} from "@angular/core";
import {FeedService} from "../../services/feed.service";
import {finalize, Observable, of, tap} from "rxjs";
import {PostDocumentResponse} from "../../models/post.response";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ActivatedRoute} from "@angular/router";
import {AccountsService} from "../../services/accounts.service";
import {Account} from "../../models/account";

@Component({
  selector: "app-feed",
  templateUrl: "./feed.component.html",
  styleUrls: ["./feed.component.scss"],
})
export class FeedComponent implements OnInit {
  loading = false;
  postDocuments: PostDocumentResponse[] = [];
  newPostForm!: FormGroup;
  submitting = false;
  account?: Account;

  constructor(
    private feedService: FeedService,
    private accountsService: AccountsService,
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      const accountId = params['accountId'] as string;
      this.accountsService.loadAccount(accountId)
        .pipe(
          tap(account => {
            this.account = account;
            this.loadFeed();
          }))
        .subscribe();
    });

    this.initForm();
  }

  private initForm(): void {
    this.newPostForm = this.fb.group({
      title: ["", [Validators.required, Validators.maxLength(200)]],
      description: ["", [Validators.required, Validators.maxLength(2000)]],
    });
  }

  private loadFeed(): void {
    this.loading = true;
    this.feedService.getShuffledFeed(this.account?.id!).pipe(
      tap((posts) => {
        this.postDocuments = posts;
      }),
      finalize(() => (this.loading = false))
    ).subscribe();
  }

  createPost(): void {
    if (this.newPostForm.invalid) {
      this.newPostForm.markAllAsTouched();
      return;
    }

    const newPost = {
      ...this.newPostForm.value, creator: {
        id: this.account?.id,
        firstName: this.account?.firstName,
        lastName: this.account?.lastName,
        nickName: this.account?.userName
      }
    };
    this.submitting = true;

    this.feedService
      .createPost(newPost)
      .pipe(
        tap(() => {
          this.loadFeed();
          this.newPostForm.reset();
        }),
        finalize(() => (this.submitting = false))
      )
      .subscribe({
        next: () => console.log("Post created successfully"),
        error: (err) => console.error("Failed to create post", err),
      });
  }
}
