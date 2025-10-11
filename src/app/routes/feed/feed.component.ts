import { Component, OnInit } from "@angular/core";
import { FeedService } from "../../services/feed.service";
import { finalize, Observable, of, tap } from "rxjs";
import { PostDocumentResponse } from "../../models/post.response";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";

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

  constructor(
    private feedService: FeedService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadFeed();
  }

  private initForm(): void {
    this.newPostForm = this.fb.group({
      title: ["", [Validators.required, Validators.maxLength(200)]],
      description: ["", [Validators.required, Validators.maxLength(2000)]],
    });
  }

  private loadFeed(): void {
    this.loading = true;
    this.feedService.getShuffledFeed().pipe(
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

    const newPost = this.newPostForm.value;
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
