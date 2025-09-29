import {Participant} from "./participant";
import {MessageContentUnion} from "./message.content";

export interface MessageRequest {
  sender: Participant;
  content: MessageContentUnion;
  replyOf?: string | null;
}
