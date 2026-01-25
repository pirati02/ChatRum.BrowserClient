import {Component, EventEmitter, Input, Output} from "@angular/core";
import {Participant} from "../../../models/participant";
import {UiMessage} from "../chat.component";

@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss']
})
export class MessageBubbleComponent {
  @Input() message!: UiMessage;
  @Input() isSender: boolean = false;
  @Input() participant?: Participant;

  @Output() retry = new EventEmitter<UiMessage>();

  onRetry() {
    this.retry.emit(this.message);
  }

  get displayName(): string {
    return this.isSender ? 'you' : (this.participant?.nickName || '');
  }

  get alignStyle(): 'start' | 'end' {
    return this.isSender ? 'end' : 'start';
  }
}
