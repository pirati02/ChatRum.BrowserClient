import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {ChatService} from "../../services/chat.service";
import {catchError, delay, map, mergeMap, Observable, of, tap} from "rxjs";
import {MessageRequest} from "../../models/message.request";
import {MessageResponse} from "../../models/message.response";
import {MessageStatus} from "../../models/message.status";
import {ActivatedRoute} from "@angular/router";
import {ApiError} from "../../models/api.error";
import {ErrorType} from "../../models/error.types";
import {Participant} from "../../models/participant";
import {Account} from "../../models/account";
import {ChatResponse} from "../../models/chat.response";

export type uiStatus = 'sent' | 'seen' | 'delivered' | ''

export interface UiMessage extends MessageResponse {
  statusString: string
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('scrollElement') scrollContainer?: ElementRef<HTMLDivElement>;
  chatGroup$?: FormGroup<{
    messageContent: FormControl<string | null>
  }>;
  chat: { chatId: string | null; messages: UiMessage[] } = {
    chatId: null,
    messages: []
  };

  me?: Participant;
  participants: Participant[] = [];
  isGroupChat: boolean = false;
  overrideExisting: boolean = false;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private chatService: ChatService,
    private ngZone: NgZone
  ) {
  }

  ngOnInit() {
    this.chatGroup$ = this.fb.group({
      messageContent: ['']
    });
    this.gatherChatInfo()
      .pipe(
        tap(() => {
          this.chatService.startConnection(this.me?.id!)
        }),
        delay(1000),
        mergeMap(({chatId}) => {
          if (this.overrideExisting){
            return of();
          }

          if (chatId) {
            return this.chatService.getChat(chatId)
              .pipe(
                tap(res => this.initializeChat(res))
              )
          }
          return this.chatService.findChat(this.participants)
            .pipe(
              tap(res => this.initializeChat(res)),
              catchError(err => {
                let apiErrors: ApiError[] = [];

                if (err.error) {
                  apiErrors = Array.isArray(err.error) ? err.error : [err.error];
                }

                const convNotFound = apiErrors.find(e => e.type === ErrorType.NotFound);
                if (convNotFound) {
                  this.startChatInternal().subscribe(() => this.cleanupMessageContent());
                }

                return of(null);
              })
            );
        })
      ).subscribe();

    this.startListeners();
  }

  private initializeChat(res: ChatResponse) {
    this.chat = {
      ...res,
      messages: res.messages.map(item => {
        item.statusString = this.statusString(item.status);
        return item;
      })
    };

    const others = this.participants.filter(p => p.id !== this.me?.id)?.map(a => a.id)!;
    const unreadMessages = this.chat.messages.filter(a => ([MessageStatus.Sent, MessageStatus.Delivered]
      .includes(a.status)) && others?.includes(a.sender.id)
    );
    if (unreadMessages.length > 0) {
      this.chatService.markAsRead(this.chat.chatId!, unreadMessages.map(item => item.messageId))
        .subscribe(res => {
          if (res) {
            this.chat.messages.forEach(item => {
              item.status = MessageStatus.Seen;
              item.statusString = this.statusString(item.status);
            })
          }
        });
    }
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.chatService.stopConnection();
  }

  sendMessage() {
    const content = this.chatGroup$?.controls.messageContent?.value!;
    if (!this.chat.chatId) {
      this.startChatInternal()
        .pipe(
          tap(() => {
            this.chatService.sendMessage(
              this.chat.chatId!,
              <MessageRequest>{
                content: content,
                sender: this.me!,
              }).subscribe(() => this.cleanupMessageContent());
          })
        )
        .subscribe(() => this.cleanupMessageContent());
    } else {
      this.chatService.sendMessage(
        this.chat.chatId!,
        <MessageRequest>{
          content: content,
          sender: this.me!,
        }).subscribe(() => this.cleanupMessageContent());
    }
  }

  getReceiver(id: string): Participant | undefined {
    return this.participants.find(p => p.id === id);
  }

  private startChatInternal() {
    return this.chatService.startChat(
      this.participants!,
      this.isGroupChat,
      this.overrideExisting
    );
  }

  private gatherChatInfo(): Observable<any> {
    return this.activatedRoute.queryParams.pipe(
      tap(params => {
        const receivers = JSON.parse(params['receivers']) as Account[];
        const me = JSON.parse(params['me']) as Account;

        this.me = <Participant>{
          id: me.id,
          firstName: me.firstName,
          lastName: me.lastName,
          nickName: me.userName
        };
        this.participants.push(this.me);

        this.participants = [...this.participants, ...receivers.map(receiver => <Participant>{
          id: receiver.id,
          firstName: receiver.firstName,
          lastName: receiver.lastName,
          nickName: receiver.userName
        })];
        this.isGroupChat = params["isGroupChat"] == "true" || false;
        this.overrideExisting = params["overrideExisting"] == "true" || false;
        this.chat = {...this.chat, chatId: params["chatId"]}
      })
    );
  }

  private startListeners() {
    this.chatService.chatStarted$.subscribe((res) => {
      this.chat.chatId = res!;
    });

    this.chatService.updateMessageState$.subscribe((res) => {
      if (res?.messageId) {
        const message = this.chat.messages.find(item => item.messageId === res?.messageId);
        message!.statusString = this.statusString(res?.status);
        message!.status = res?.status;
      }
    });

    this.chatService.chatAppendMessage$.subscribe((result) => {
      if (result?.message) {
        if (this.chat.messages.some(a => a.messageId === result?.message.messageId)) {
          return;
        }

        result!.message!.statusString = this.statusString(result!.message?.status);
        this.chat.messages.push(result!.message);
        if (result?.update === true) {
          this.chatService.updateMessageStatus(result!.message, MessageStatus.Seen);
        }
        this.scrollToBottom();
      }
    });
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
