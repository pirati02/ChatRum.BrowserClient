import {Participant} from "./participant";

export interface MessageRequest {
  sender: Participant;
  content: string;
  replyOf?: string | null;
}
