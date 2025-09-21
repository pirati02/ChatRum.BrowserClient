import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {ConversationService} from "../../services/conversation.service";
import {catchError, finalize, of, tap} from "rxjs";
import {MessageRequest} from "../../models/message.request";
import {MessageResponse} from "../../models/message.response";
import {MessageStatus} from "../../models/message.status";
import {ActivatedRoute} from "@angular/router";
import {UiAccount} from "../accounts/accounts.component";
import {ApiError} from "../../models/api.error";
import {ErrorType} from "../../models/error.types";

export type uiStatus = 'sent' | 'seen' | 'delivered' | ''

export interface UiMessage extends MessageResponse {
  statusString: string
}

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})
export class ConversationComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('scrollElement') scrollContainer?: ElementRef<HTMLDivElement>;
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
    private conversationService: ConversationService,
    private ngZone: NgZone
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

          const unreadMessages = this.conversation.messages.filter(a => ([MessageStatus.Sent, MessageStatus.Delivered].includes(a.status)) && a.senderId === this.receiver?.id);
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
        catchError(err => {
          let apiErrors: ApiError[] = [];

          if (err.error) {
            apiErrors = Array.isArray(err.error) ? err.error : [err.error];
          }

          const convNotFound = apiErrors.find(e => e.type ===  ErrorType.NotFound);
          if (convNotFound) {
            this.startConversation().subscribe(() => this.cleanupMessageContent());
          }

          return of(null);
        }),
        finalize(() => {
          this.conversationService.startConnection(this.sender?.id!)
        })
      )
      .subscribe();

    this.conversationService.updateMessageState$.subscribe((res) => {
      if (res?.messageId) {
        const message = this.conversation.messages.find(item => item.messageId === res?.messageId);
        message!.statusString = this.statusString(res?.status);
        message!.status = res?.status;
      }
    });

    this.conversationService.conversationAppendMessage$.subscribe((result) => {
      if (result?.message) {
        result!.message!.statusString = this.statusString(result!.message?.status);
        this.conversation.messages.push(result!.message);
        if (result?.update === true) {
          this.conversationService.updateMessageStatus(result!.message, MessageStatus.Seen);
        }
        this.scrollToBottom();
      }
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.conversationService.stopConnection();
  }

  sendMessage() {
    const content = this.chatGroup$?.controls.messageContent?.value!;
    if (!this.conversation.conversationId) {
      this.startConversation(<MessageRequest>{
        content: content
      }).subscribe(() => this.cleanupMessageContent());
    }

    this.conversationService.sendMessage(
      this.conversation.conversationId!,
      <MessageRequest>{
        content: content,
        senderId: this.sender?.id!,
        receiverId: this.receiver?.id!
      }).subscribe(() => this.cleanupMessageContent());
  }

  private startConversation(request: MessageRequest | null = null){
    return this.conversationService.startConversation(
      this.sender?.id!,
      this.receiver?.id!,
      request
    );
  }

  private cleanupMessageContent() {
    this.chatGroup$?.controls.messageContent.patchValue('');
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.ngZone.run(() => {
      const scrollContainer = this.scrollContainer!.nativeElement;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
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
