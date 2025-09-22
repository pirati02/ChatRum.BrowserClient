import {LastestMessage} from "./latest-message.response";

export interface LastChatResponse {
  chatId: string;
  message: LastestMessage,
  participantIds: string[]
}
