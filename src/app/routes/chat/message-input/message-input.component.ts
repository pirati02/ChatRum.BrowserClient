import {Component, EventEmitter, Input, Output} from "@angular/core";

export interface SendMessageEvent {
  content: string;
}

export interface SendFileEvent {
  file: File;
}

@Component({
  selector: 'app-message-input',
  templateUrl: './message-input.component.html',
  styleUrls: ['./message-input.component.scss']
})
export class MessageInputComponent {
  @Input() placeholder: string = 'Type a message...';

  @Output() sendMessage = new EventEmitter<SendMessageEvent>();
  @Output() sendFile = new EventEmitter<SendFileEvent>();

  messageContent: string = '';
  private selectedFile?: File;
  displayPlaceholder: string = this.placeholder;

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = Array.from(target.files!)[0];
    if (file) {
      this.selectedFile = file;
      this.displayPlaceholder = file.name;
    }
  }

  onSend() {
    if (this.selectedFile) {
      this.sendFile.emit({file: this.selectedFile});
      this.clearFile();
      return;
    }

    if (this.messageContent?.trim()) {
      this.sendMessage.emit({content: this.messageContent});
      this.messageContent = '';
    }
  }

  clearFile() {
    this.selectedFile = undefined;
    this.displayPlaceholder = this.placeholder;
    this.messageContent = '';
  }
}
