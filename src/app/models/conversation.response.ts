import {UiMessage} from "../routes/conversation/conversation.component";

export interface ConversationResponse {
  conversationId: string;
  messages: UiMessage[]
}
