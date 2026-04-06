import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import {
  AttachmentContent,
  MessageContent,
} from '../../../models/message.content';
import { environment } from '../../../../environments/environment';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import {
  getAttachment,
  getDisplayKind,
  isImageAttachment,
  loadAttachmentImage,
  resolveUrl,
  revokeAttachmentImageUrl,
  tryGetImageUrl,
  withAccessToken,
} from './message-content.helpers';

@Component({
  selector: 'app-message-content',
  templateUrl: './message-content.component.html',
  styleUrls: ['./message-content.component.scss'],
})
export class MessageContentComponent implements OnChanges, OnDestroy {
  @Input() content!: MessageContent;
  @Input() alignStyle: 'start' | 'end' = 'start';
  private readonly gatewayBase = environment.gatewayUrl.replace(/\/$/, '');
  private imageLoadSub?: Subscription;
  private attachmentImageObjectUrl: string | null = null;
  displayKind = 'plain';
  attachment: AttachmentContent | null = null;
  isImageAttachment = false;
  isImageUrlContent = false;
  imageSource: string | null = null;
  contentUrl = '';
  attachmentUrl = '';
  attachmentDownloadUrl = '';
  attachmentImageUrl = '';
  modalImageUrl = '';
  isImageModalOpen = false;

  constructor(
    private readonly http: HttpClient,
    private readonly authSession: AuthSessionService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.displayKind = getDisplayKind(this.content);
      this.attachment = getAttachment(this.content, this.displayKind);
      this.isImageAttachment = isImageAttachment(this.attachment);
      this.contentUrl = resolveUrl(this.content?.content, this.gatewayBase);
      this.imageSource = tryGetImageUrl(this.contentUrl);
      this.isImageUrlContent = this.imageSource !== null;
      this.attachmentUrl = resolveUrl(this.attachment?.content, this.gatewayBase);
      this.attachmentDownloadUrl = withAccessToken(
        this.attachmentUrl,
        this.authSession.getAccessToken(),
      );

      this.imageLoadSub?.unsubscribe();
      this.attachmentImageObjectUrl = revokeAttachmentImageUrl(this.attachmentImageObjectUrl);

      this.imageLoadSub = loadAttachmentImage(
        this.http,
        this.attachment,
        this.isImageAttachment,
        this.attachmentUrl,
        this.authSession.getAccessToken(),
        (blob) => {
          this.attachmentImageObjectUrl = revokeAttachmentImageUrl(this.attachmentImageObjectUrl);
          this.attachmentImageObjectUrl = URL.createObjectURL(blob);
          this.attachmentImageUrl = this.attachmentImageObjectUrl ?? '';
        },
        () => {
          this.attachmentImageObjectUrl = revokeAttachmentImageUrl(this.attachmentImageObjectUrl);
          this.attachmentImageUrl = '';
        },
      );
    }
  }

  ngOnDestroy(): void {
    this.imageLoadSub?.unsubscribe();
    this.attachmentImageObjectUrl = revokeAttachmentImageUrl(this.attachmentImageObjectUrl);
    this.attachmentImageUrl = '';
  }

  openImageFullSize(imageUrl: string | null | undefined): void {
    if (typeof imageUrl !== 'string') {
      return;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return;
    }

    this.modalImageUrl = trimmed;
    this.isImageModalOpen = true;
  }

  closeImageModal(): void {
    this.isImageModalOpen = false;
    this.modalImageUrl = '';
  }
}
