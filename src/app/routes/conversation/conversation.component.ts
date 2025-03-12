import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {ConversationService} from "../../services/conversation.service";
import {catchError, finalize, of, tap} from "rxjs";
import {MessageRequest} from "../../models/message.request";
import {MessageResponse} from "../../models/message.response";
import {MessageStatus} from "../../models/message.status";
import {ActivatedRoute} from "@angular/router";
import {UiAccount} from "../accounts/accounts.component";

export type uiStatus = 'sent' | 'seen' | 'delivered' | ''

export interface UiMessage extends MessageResponse {
  statusString: string
}

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})
export class ConversationComponent implements OnInit, OnDestroy {

  @ViewChild('scrollElement') scrollElement?: ElementRef<HTMLDivElement>;
  chatGroup$?: FormGroup<{
    messageContent: FormControl<string | null>
  }>;
  conversation: { conversationId: string | null; messages: UiMessage[] } = {
    conversationId: null,
    messages: []
  };
  receiver?: UiAccount;
  sender?: UiAccount;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private conversationService: ConversationService
  ) {
  }

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(params => {
      this.receiver = JSON.parse(params['receiver']);
      this.sender = JSON.parse(params['sender']);
    });
    this.chatGroup$ = this.fb.group({
      messageContent: ['']
    });
    this.conversationService.findConversation(this.sender?.id!, this.receiver?.id!)
      .pipe(
        tap(res => {
          this.conversation = {
            ...res, messages: res.messages.map(item => {
              item.statusString = this.statusString(item.status);
              return item;
            })
          };

          const unreadMessages = this.conversation.messages.filter(a => a.status === MessageStatus.Sent);
          if (unreadMessages.length > 0) {
            this.conversationService.markAsRead(this.conversation.conversationId!, unreadMessages.map(item => item.messageId))
              .subscribe(res => {
                if (res) {
                  this.conversation.messages.forEach(item => {
                    item.status = MessageStatus.Seen;
                    item.statusString = this.statusString(item.status);
                  })
                }
              });
          }
        }),
        catchError(error => {
          return of(null);
        }),
        finalize(() => {
          this.conversationService.startConnection(this.conversation.conversationId!)
        })
      )
      .subscribe();

    this.conversationService.conversationAppendMessage$.subscribe(message => {
      if (message) {
        this.conversationService.updateMessageStatus(message, MessageStatus.Seen);
        message!.statusString = this.statusString(message?.status);
        this.conversation.messages.push(message);
        this.scrollElement!.nativeElement.scrollTop = this.scrollElement!.nativeElement.scrollHeight;
      }
    });

    this.conversationService.updateMessageState$.subscribe((res) => {
      if (res?.messageId) {
        const message = this.conversation.messages.find(item => item.messageId === res?.messageId);
        message!.statusString = this.statusString(res?.status);
      }
    })
  }

  ngOnDestroy() {
    this.conversationService.stopConnection();
  }

  sendMessage() {
    const content = this.chatGroup$?.controls.messageContent?.value!;
    if (!this.conversation.conversationId) {
      this.conversationService.startConversation(
        this.conversation.conversationId!,
        this.sender?.id!,
        this.receiver?.id!,
        <MessageRequest>{
          content: content,
          senderId: this.sender?.id!
        }
      )
        .subscribe();
    }

    this.conversationService.sendMessage(
      this.conversation.conversationId!,
      <MessageRequest>{
        content: content,
        senderId: this.sender?.id!
      }).subscribe();
  }

  private statusString(status: MessageStatus): uiStatus {
    switch (status) {
      case MessageStatus.Sent:
        return "sent";
      case MessageStatus.Delivered:
        return "delivered";
      case MessageStatus.Seen:
        return "seen";
      default:
        return '';
    }
  }
}
