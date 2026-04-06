import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PostDocumentResponse } from '../models/post.response';
import { CreatePostRequest } from '../models/post.request';
import {
  AddCommentRequest,
  PostDetailsResponse,
  ToggleReactionRequest,
} from '../models/post-details.response';

@Injectable({
  providedIn: 'root',
})
export class FeedService {
  constructor(
    @Inject('FEED_BASE_URL') private baseUrl: string,
    private httpClient: HttpClient,
  ) {}

  getShuffledFeed(creatorId: string, limit: number = 10) {
    return this.httpClient.get<PostDocumentResponse[]>(
      this.baseUrl + `/shuffled/${creatorId}`,
      {
        params: {
          limit: limit.toString(),
        },
      },
    );
  }

  createPost(post: CreatePostRequest) {
    return this.httpClient.post<string>(this.baseUrl, post);
  }

  uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.httpClient.post<FeedAttachmentUploadResponse>(
      this.baseUrl + `/attachments`,
      formData,
    );
  }

  getPostDetails(postId: string) {
    return this.httpClient.get<PostDetailsResponse>(
      this.baseUrl + `/${postId}/details`,
    );
  }

  togglePostReaction(postId: string, payload: ToggleReactionRequest) {
    return this.httpClient.put<void>(this.baseUrl + `/${postId}/reactions`, payload);
  }

  addComment(postId: string, payload: AddCommentRequest) {
    return this.httpClient.post<string>(
      this.baseUrl + `/${postId}/comments`,
      payload,
    );
  }

  addReply(postId: string, commentId: string, payload: AddCommentRequest) {
    return this.httpClient.post<string>(
      this.baseUrl + `/${postId}/comments/${commentId}/replies`,
      payload,
    );
  }

  toggleCommentReaction(commentId: string, payload: ToggleReactionRequest) {
    return this.httpClient.put<void>(
      this.baseUrl + `/comments/${commentId}/reactions`,
      payload,
    );
  }
}

export interface FeedAttachmentUploadResponse {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}
