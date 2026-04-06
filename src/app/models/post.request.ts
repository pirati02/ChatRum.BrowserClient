import { Participant } from './participant';

export interface CreatePostRequest {
  creator: Participant;
  description: string;
  attachmentIds: string[];
}
