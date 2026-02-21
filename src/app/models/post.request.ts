import { Participant } from './participant';

export interface CreatePostRequest {
  creator: Participant;
  title: string;
  description: string;
}
