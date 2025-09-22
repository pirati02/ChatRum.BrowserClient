import {MessageStatus} from "./message.status";
import {Participant} from "./participant";

export interface MessageResponse {
  chatId: string;
  messageId: string;
  content: string;
  status: MessageStatus;
  sender: Participant;
  replyOf?: string | null;
}
