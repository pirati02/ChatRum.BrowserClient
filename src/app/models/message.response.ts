import {MessageStatus} from "./message.status";

export interface MessageResponse {
  conversationId: string;
  messageId: string;
  content: string;
  status: MessageStatus;
  senderId: string;
  replyOf?: string | null;
}
