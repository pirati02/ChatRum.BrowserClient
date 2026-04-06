import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Account } from '../../../models/account';
import { FeedService } from '../../../services/feed.service';

type MarkdownAction = 'bold' | 'italic' | 'heading' | 'list' | 'link';

@Component({
  selector: 'app-create-post',
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.scss'],
})
export class CreatePostComponent {
  @Input() account?: Account;
  @Output() postCreated = new EventEmitter<void>();

  newPostForm: FormGroup;
  submitting = false;
  selectedImageFiles: File[] = [];
  readonly maxImageCount = 8;
  readonly maxImageSizeBytes = 20 * 1024 * 1024;
  private readonly markdownCache = new Map<string, SafeHtml>();

  constructor(
    private fb: FormBuilder,
    private feedService: FeedService,
    private sanitizer: DomSanitizer,
  ) {
    this.newPostForm = this.fb.group({
      description: ['', [Validators.required, Validators.maxLength(10000)]],
    });
  }

  createPost(): void {
    if (this.newPostForm.invalid) {
      this.newPostForm.markAllAsTouched();
      return;
    }
    if (!this.account?.id) {
      return;
    }

    this.submitting = true;
    const creator = {
      id: this.account.id,
      firstName: this.account.firstName,
      lastName: this.account.lastName,
      nickName: this.account.userName,
      isAdmin: false,
    };
    const uploads$ =
      this.selectedImageFiles.length > 0
        ? forkJoin(this.selectedImageFiles.map((file) => this.feedService.uploadAttachment(file)))
        : of([]);

    uploads$
      .pipe(
        map((uploads) => uploads.map((upload) => upload.id)),
        switchMap((attachmentIds) =>
          this.feedService.createPost({
            creator,
            description: this.newPostForm.value.description,
            attachmentIds,
          }),
        ),
        tap(() => this.resetCreatePostForm()),
        finalize(() => (this.submitting = false)),
      )
      .subscribe({
        next: () => this.postCreated.emit(),
        error: (err) => console.error('Failed to create post', err),
      });
  }

  onImageSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      return;
    }

    const incoming = files
      .filter((file) => file.type.startsWith('image/'))
      .filter((file) => file.size <= this.maxImageSizeBytes);
    this.selectedImageFiles = [...this.selectedImageFiles, ...incoming].slice(0, this.maxImageCount);
    input.value = '';
  }

  removeSelectedImage(index: number): void {
    this.selectedImageFiles = this.selectedImageFiles.filter((_, i) => i !== index);
  }

  onDescriptionKeydown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    let action: MarkdownAction | null = null;

    if (key === 'b') {
      action = 'bold';
    } else if (key === 'i') {
      action = 'italic';
    } else if (key === 'k') {
      action = 'link';
    } else if (event.shiftKey && key === 'h') {
      action = 'heading';
    } else if (event.shiftKey && key === '8') {
      action = 'list';
    }

    if (!action) {
      return;
    }

    event.preventDefault();
    this.applyMarkdown(action, textarea);
  }

  applyMarkdown(action: MarkdownAction, textarea: HTMLTextAreaElement): void {
    const value = this.newPostForm.value.description ?? '';
    const selectionStart = textarea.selectionStart ?? value.length;
    const selectionEnd = textarea.selectionEnd ?? value.length;
    const selected = value.slice(selectionStart, selectionEnd);

    let insertionStart = '';
    let insertionEnd = '';
    let placeholder = '';

    if (action === 'bold') {
      insertionStart = '**';
      insertionEnd = '**';
      placeholder = 'bold text';
    } else if (action === 'italic') {
      insertionStart = '*';
      insertionEnd = '*';
      placeholder = 'italic text';
    } else if (action === 'heading') {
      insertionStart = '## ';
      placeholder = 'Heading';
    } else if (action === 'list') {
      insertionStart = '- ';
      placeholder = 'List item';
    } else {
      const defaultLabel = selected || 'link text';
      const url = window.prompt('Enter URL', 'https://');
      if (!url) {
        return;
      }
      insertionStart = '[';
      insertionEnd = `](${url})`;
      placeholder = defaultLabel;
    }

    const content = selected || placeholder;
    const nextValue = [
      value.slice(0, selectionStart),
      insertionStart,
      content,
      insertionEnd,
      value.slice(selectionEnd),
    ].join('');

    this.newPostForm.patchValue({ description: nextValue });
    this.newPostForm.get('description')?.markAsDirty();

    const cursorStart = selectionStart + insertionStart.length;
    const cursorEnd = cursorStart + content.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
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

  private resetCreatePostForm(): void {
    this.newPostForm.reset();
    this.selectedImageFiles = [];
  }
}
