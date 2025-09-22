import {Participant} from "./participant";

export interface LastestMessage {
  chatId: string;
  messageId: string;
  content: string;
  sender: Participant;
}
