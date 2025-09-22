import {UiMessage} from "../routes/chat/chat.component";

export interface ChatResponse {
  chatId: string;
  messages: UiMessage[]
}
