import {Component, Input} from "@angular/core";
import {MessageContent} from "../../../models/message.content";

@Component({
  selector: 'app-message-content',
  templateUrl: './message-content.component.html',
  styleUrls: ['./message-content.component.scss']
})
export class MessageContentComponent {
  @Input() content!: MessageContent;
  @Input() alignStyle: 'start' | 'end' = 'start';
}
