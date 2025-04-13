import {LastestMessageResponse} from "./latest-message.response";

export interface LastConversationResponse {
  conversationId: string;
  message: LastestMessageResponse,
  participantIds: string[]
}
