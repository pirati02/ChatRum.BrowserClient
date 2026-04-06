import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
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
export class MessageBubbleComponent implements OnDestroy {
  @Input() message!: UiMessage;
  @Input() isSender: boolean = false;
  @Input() participant?: Participant;
  @Input() myParticipantId: string = '';

  @Output() retry = new EventEmitter<UiMessage>();
  @Output() toggleReaction = new EventEmitter<{
    message: UiMessage;
    emoji: MessageReactionEmoji;
  }>();
  showReactionActions = false;

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly longPressDelayMs = 500;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

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
    this.hideReactionActions();
  }

  onBubbleContextMenu(event: MouseEvent) {
    event.preventDefault();

    if (this.isSmallDevice) {
      return;
    }

    this.showReactionActions = !this.showReactionActions;
  }

  onBubbleTouchStart() {
    if (!this.isSmallDevice) {
      return;
    }

    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.showReactionActions = !this.showReactionActions;
      this.longPressTimer = null;
    }, this.longPressDelayMs);
  }

  onBubbleTouchEnd() {
    this.clearLongPressTimer();
  }

  onBubbleTouchCancel() {
    this.clearLongPressTimer();
  }

  onBubbleTouchMove() {
    this.clearLongPressTimer();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.hideIfOutside(event.target);
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouchStart(event: TouchEvent) {
    this.hideIfOutside(event.target);
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent) {
    this.hideIfOutside(event.target);
  }

  @HostListener('document:keydown.escape')
  onEscapePressed() {
    this.hideReactionActions();
  }

  ngOnDestroy() {
    this.clearLongPressTimer();
  }

  private get isSmallDevice(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  }

  private clearLongPressTimer() {
    if (!this.longPressTimer) {
      return;
    }

    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  private hideIfOutside(target: EventTarget | null) {
    if (!(target instanceof Node)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(target)) {
      this.hideReactionActions();
    }
  }

  private hideReactionActions() {
    this.showReactionActions = false;
  }
}
