export interface MessageRequest {
  senderId: string;
  receiverId: string;
  content: string;
  replyOf?: string | null;
}
