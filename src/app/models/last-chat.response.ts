import {LastestMessage} from "./latest-message.response";
import {Participant} from "./participant";

export interface LastChatResponse {
  chatId: string;
  isGroupChat: boolean,
  message: LastestMessage,
  participants: Participant[]
}
