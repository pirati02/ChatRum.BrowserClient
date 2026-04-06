import { Participant } from './participant';
import { Reaction, PostDocumentResponse, ReactionType } from './post.response';

export interface PostDetailsResponse {
  post: PostDocumentResponse;
  comments: CommentThreadResponse[];
}

export interface CommentThreadResponse {
  comment: CommentResponse;
  replies: CommentThreadResponse[];
}

export interface CommentResponse {
  id: string;
  postId: string;
  parentCommentId?: string;
  creator: Participant;
  content: string;
  creationDate: string;
  reactions: Reaction[];
}

export interface ToggleReactionRequest {
  actor: Participant;
  reactionType: ReactionType;
}

export interface AddCommentRequest {
  creator: Participant;
  content: string;
}
