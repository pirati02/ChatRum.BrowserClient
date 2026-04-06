import { Participant } from './participant';

export interface PostDocumentResponse {
  id: string;
  creator: Participant;
  creationDate: string;
  reactions: Reaction[];
  shares: Share[];
  title: string;
  description: string;
  attachments: AttachmentId[];
}

export interface Reaction {
  actor: Participant;
  reactionType: ReactionType;
}

export type ReactionType =
  | 'Like'
  | 'Heart'
  | 'Laugh'
  | 'Wow'
  | 'Sad'
  | 'Angry'
  | 'Care'
  | number;

export interface Share {
  actor: Participant;
  resharedTitle: string;
}

export interface AttachmentId {
  id: string;
}
