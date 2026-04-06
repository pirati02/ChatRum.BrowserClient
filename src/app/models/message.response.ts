import { MessageStatus } from './message.status';
import { Participant } from './participant';
import { MessageContentUnion } from './message.content';
import { MessageReaction } from './message-reaction';

export interface MessageResponse {
  chatId: string;
  messageId: string;
  content: MessageContentUnion;
  status: MessageStatus;
  sender: Participant;
  replyOf?: string | null;
  reactions: MessageReaction[];
}
