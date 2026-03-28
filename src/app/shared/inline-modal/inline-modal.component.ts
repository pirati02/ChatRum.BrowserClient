import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-inline-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inline-modal.component.html',
  styleUrl: './inline-modal.component.scss',
  host: {
    class: 'inline-modal',
  },
})
export class InlineModalComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.open) {
      event.preventDefault();
      this.close();
    }
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.openChange.emit(false);
  }

  onBackdropClick(): void {
    this.close();
  }
}
