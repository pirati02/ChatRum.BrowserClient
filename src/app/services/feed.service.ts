import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {PostDocumentResponse} from "../models/post.response";
import {CreatePostRequest} from "../models/post.request";

@Injectable({
  providedIn: 'root',
})
export class FeedService {
  constructor(
    @Inject('FEED_BASE_URL') private baseUrl: string,
    private httpClient: HttpClient
  ) {

  }

  getShuffledFeed() {
    return this.httpClient
      .get<PostDocumentResponse[]>(this.baseUrl)
  }

  createPost(post: CreatePostRequest) {
    return this.httpClient
      .post<string>(this.baseUrl, post);
  }
}
