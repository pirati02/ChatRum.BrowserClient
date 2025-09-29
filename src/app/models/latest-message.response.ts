import {Participant} from "./participant";
import {MessageContentUnion} from "./message.content";

export interface LastestMessage {
  chatId: string;
  messageId: string;
  content: MessageContentUnion;
  sender: Participant;
}
