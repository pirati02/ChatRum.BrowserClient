import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Participant } from '../../models/participant';

export interface ChatDetailsData {
  participants: Participant[];
  creator: Participant | null;
  createdDate: string;
}

@Component({
  selector: 'app-chat-details',
  templateUrl: './chat-details.component.html',
})
export class ChatDetailsComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ChatDetailsData,
    private dialogRef: MatDialogRef<ChatDetailsComponent>,
  ) {}

  close() {
    this.dialogRef.close();
  }
}
