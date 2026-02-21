import { UiMessage } from '../routes/chat/chat.component';
import { Participant } from './participant';

export interface ChatResponse {
  chatId: string;
  messages: UiMessage[];
  participants: Participant[];
  creator: Participant;
  createdDate: string;
}
