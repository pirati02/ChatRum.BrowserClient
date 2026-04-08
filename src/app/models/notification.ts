export type NotificationType =
  | 'PostComment'
  | 'CommentReply'
  | 'PostReaction'
  | 'CommentReaction'
  | 'FriendRequestReceived'
  | 'FriendRequestAccepted'
  | 'FriendRequestRejected'
  | string;

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorDisplayName: string;
  actorAvatarUrl?: string | null;
  type: NotificationType;
  targetId: string;
  targetPreview?: string | null;
  reaction?: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPageResponse {
  items: NotificationItem[];
  nextCursor?: string | null;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
