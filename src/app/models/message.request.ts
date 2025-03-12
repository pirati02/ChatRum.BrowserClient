export interface MessageRequest {
  senderId: string;  // Guid in C# -> string in TypeScript
  content: string;
  replyOf?: string | null;  // Nullable Guid -> Optional string | null
}
