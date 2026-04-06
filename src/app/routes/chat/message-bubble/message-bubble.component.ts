import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Participant } from '../../../models/participant';
import { UiMessage } from '../chat.component';
import {
  MESSAGE_REACTION_EMOJIS,
  MessageReactionEmoji,
} from '../../../models/message-reaction';

@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss'],
})
export class MessageBubbleComponent {
  @Input() message!: UiMessage;
  @Input() isSender: boolean = false;
  @Input() participant?: Participant;
  @Input() myParticipantId: string = '';

  @Output() retry = new EventEmitter<UiMessage>();
  @Output() toggleReaction = new EventEmitter<{
    message: UiMessage;
    emoji: MessageReactionEmoji;
  }>();

  onRetry() {
    this.retry.emit(this.message);
  }

  get displayName(): string {
    return this.isSender ? 'you' : this.participant?.nickName || '';
  }

  get alignStyle(): 'start' | 'end' {
    return this.isSender ? 'end' : 'start';
  }

  get reactionOptions(): readonly MessageReactionEmoji[] {
    return MESSAGE_REACTION_EMOJIS;
  }

  get groupedReactions(): {
    emoji: MessageReactionEmoji;
    count: number;
    mine: boolean;
  }[] {
    const byEmoji = new Map<
      MessageReactionEmoji,
      { emoji: MessageReactionEmoji; count: number; mine: boolean }
    >();
    for (const reaction of this.message.reactions ?? []) {
      const current = byEmoji.get(reaction.emoji);
      if (!current) {
        byEmoji.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          mine: reaction.actorId === this.myParticipantId,
        });
        continue;
      }

      current.count += 1;
      current.mine = current.mine || reaction.actorId === this.myParticipantId;
    }

    return Array.from(byEmoji.values());
  }

  onToggleReaction(emoji: MessageReactionEmoji) {
    this.toggleReaction.emit({ message: this.message, emoji });
  }
}
