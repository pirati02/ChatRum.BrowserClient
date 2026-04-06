export type MessageReactionEmoji = '👍' | '❤️' | '😂' | '😮' | '😢' | '🙏';

export interface MessageReaction {
  actorId: string;
  emoji: MessageReactionEmoji;
}

export const MESSAGE_REACTION_EMOJIS: readonly MessageReactionEmoji[] = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🙏',
] as const;
