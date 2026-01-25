import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {ChatService} from "../../services/chat.service";
import {catchError, delay, mergeMap, Observable, of, Subscription, tap} from "rxjs";
import {MessageRequest} from "../../models/message.request";
import {MessageResponse} from "../../models/message.response";
import {MessageStatus} from "../../models/message.status";
import {ActivatedRoute} from "@angular/router";
import {ApiError} from "../../models/api.error";
import {ErrorType} from "../../models/error.types";
import {Participant} from "../../models/participant";
import {Account} from "../../models/account";
import {MatDialog} from "@angular/material/dialog";
import {ChatDetailsComponent, ChatDetailsData} from "../chat-details/chat-details.component";
import {ChatResponse} from "../../models/chat.response";
import {ImageContent, MessageContent, PlainTextContent} from "../../models/message.content";
import {HelperService} from "../../services/helper.service";
import {SendFileEvent, SendMessageEvent} from "./message-input/message-input.component";

export type uiStatus = 'sent' | 'seen' | 'delivered' | 'failed' | ''

export interface UiMessage extends MessageResponse {
  statusString: string,
}

interface Chat {
  chatId: string | null;
  messages: UiMessage[],
  participants?: Participant[],
  creator: Participant | null,
  createdDate: string | null
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('scrollElement') scrollContainer?: ElementRef<HTMLDivElement>;
  chat: Chat = <Chat>{
    chatId: null,
    messages: [],
    participants: [],
    creator: null,
    createdDate: null
  };

  me?: Participant;
  overrideExisting: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private chatService: ChatService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private helperService: HelperService
  ) {
  }

  ngOnInit() {
    this.gatherChatInfo()
      .pipe(
        tap(() => {
          this.chatService.startConnection(this.me?.id!)
        }),
        delay(1000),
        mergeMap(({chatId}) => {
          if (this.overrideExisting) {
            return of();
          }

          if (chatId) {
            return this.chatService.getChat(chatId)
              .pipe(tap(res => this.initializeChat(res)))
          }
          return this.chatService.findChat(this.chat?.participants!)
            .pipe(
              tap(res => this.initializeChat(res)),
              catchError(err => {
                let apiErrors: ApiError[] = [];

                if (err.error) {
                  apiErrors = Array.isArray(err.error) ? err.error : [err.error];
                }

                const convNotFound = apiErrors.find(e => e.type === ErrorType.NotFound);
                if (convNotFound) {
                  this.startChatInternal().subscribe(() => this.scrollToBottom());
                }

                return of(null);
              })
            );
        })
      ).subscribe();

    this.startListeners();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.chatService.stopConnection();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSendMessage(event: SendMessageEvent) {
    const content = event.content?.trim();
    if (!content) return;

    const messageContent = this.helperService.isLink(content)
      ? <MessageContent>{type: 'link', content}
      : <PlainTextContent>{type: 'plain', content};

    this.dispatchMessage({
      sender: this.me!,
      content: messageContent,
      replyOf: null
    });
  }

  onSendFile(event: SendFileEvent) {
    if (!event.file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      this.dispatchMessage({
        sender: this.me!,
        content: <ImageContent>{type: 'image', content: base64},
        replyOf: null
      });
    };
    reader.readAsDataURL(event.file);
  }

  private dispatchMessage(message: MessageRequest) {
    const send$ = this.chat.chatId
      ? this.chatService.sendMessage(this.chat.chatId, message)
      : this.startChatInternal().pipe(
          mergeMap(() => this.chatService.sendMessage(this.chat.chatId!, message))
        );

    send$.subscribe(() => this.scrollToBottom());
  }

  openChatDetails() {
    this.dialog.open(ChatDetailsComponent, {
      width: '400px',
      data: <ChatDetailsData>{
        participants: this.chat.participants,
        creator: this.chat.creator,
        createdDate: this.chat.createdDate
      }
    });
  }

  retryMessage(message: UiMessage) {
    if (!this.chat.chatId) return;

    message.status = MessageStatus.Sent;
    message.statusString = this.statusString(MessageStatus.Sent);

    this.chatService.sendMessage(this.chat.chatId, {
      sender: message.sender,
      content: message.content,
      replyOf: message.replyOf
    }).subscribe();
  }

  getReceiver(id: string): Participant | undefined {
    return this.chat?.participants?.find(p => p.id === id);
  }

  private initializeChat(res: ChatResponse) {
    this.chat = {
      ...res,
      messages: res.messages.map(m => this.toUiMessage(m)),
      participants: res.participants,
      creator: res.creator,
      createdDate: res.createdDate
    };

    this.markUnreadMessagesAsSeen();
  }

  private toUiMessage(message: MessageResponse): UiMessage {
    return {
      ...message,
      statusString: this.statusString(message.status)
    };
  }

  private markUnreadMessagesAsSeen() {
    const otherParticipantIds = this.chat.participants
      ?.filter(p => p.id !== this.me?.id)
      .map(p => p.id) ?? [];

    const unreadMessages = this.chat.messages.filter(m =>
      [MessageStatus.Sent, MessageStatus.Delivered].includes(m.status) &&
      otherParticipantIds.includes(m.sender.id)
    );

    if (unreadMessages.length === 0) return;

    this.chatService.markAsRead(this.chat.chatId!, unreadMessages.map(m => m.messageId))
      .subscribe(success => {
        if (success) {
          this.chat.messages.forEach(m => {
            m.status = MessageStatus.Seen;
            m.statusString = this.statusString(MessageStatus.Seen);
          });
        }
      });
  }

  private startChatInternal() {
    const chatName = this.chat.participants?.length! > 2
      ? this.chat?.participants!.map(p => p.nickName).join(', ')
      : this.chat?.participants!.find(p => p.id !== this.me?.id)?.nickName;

    return this.chatService.startChat(
      this.chat?.participants!!,
      this.me!,
      chatName!,
      this.overrideExisting
    );
  }

  private gatherChatInfo(): Observable<any> {
    return this.activatedRoute.queryParams.pipe(
      tap(params => {
        const receivers = JSON.parse(params['receivers']) as Account[];
        const me = JSON.parse(params['me']) as Account;

        this.me = this.toParticipant(me);
        this.overrideExisting = params["overrideExisting"] === "true";
        this.chat = {
          ...this.chat,
          chatId: params["chatId"],
          participants: [
            ...this.chat.participants!,
            ...receivers.map(r => this.toParticipant(r)),
            this.me
          ]
        };
      })
    );
  }

  private toParticipant(account: Account): Participant {
    return {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      nickName: account.userName,
      isAdmin: false
    };
  }

  private startListeners() {
    this.subscriptions.push(
      this.chatService.chatStarted$.subscribe(res => this.chat.chatId = res!),
      this.chatService.updateMessageState$.subscribe(result => this.handleMessageStateUpdate(result)),
      this.chatService.chatAppendMessage$.subscribe(result => this.handleNewMessage(result)),
      this.chatService.messageFailed$.subscribe(result => this.handleMessageFailed(result))
    );
  }

  private handleMessageStateUpdate(result: { messageId: string; status: MessageStatus } | null) {
    if (!result?.messageId) return;

    const message = this.chat.messages.find(item => item.messageId === result.messageId);
    if (message) {
      message.status = result.status;
      message.statusString = this.statusString(result.status);
    }
  }

  private handleNewMessage(result: { message: UiMessage; update: boolean } | null) {
    if (!result?.message) return;
    if (this.chat.messages.some(m => m.messageId === result.message.messageId)) return;

    result.message.statusString = this.statusString(result.message.status);
    this.chat.messages.push(result.message);

    if (result.update) {
      this.chatService.updateMessageStatus(result.message, MessageStatus.Seen);
    }
    this.scrollToBottom();
  }

  private handleMessageFailed(result: UiMessage | null) {
    if (!result) return;

    const message = this.chat.messages.find(item => item.messageId === result.messageId);
    if (message) {
      message.status = MessageStatus.Failed;
      message.statusString = this.statusString(MessageStatus.Failed);
    } else {
      result.status = MessageStatus.Failed;
      result.statusString = this.statusString(MessageStatus.Failed);
      this.chat.messages.push(result);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    this.ngZone.run(() => {
      const scrollContainer = this.scrollContainer!.nativeElement;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
  }

  private statusString(status: 'Seen' | 'Sent' | 'Delivered' | 'Failed' | MessageStatus): uiStatus {
    switch (status) {
      case 'Sent':
      case MessageStatus.Sent:
        return "sent";
      case 'Delivered':
      case MessageStatus.Delivered:
        return "delivered";
      case 'Seen':
      case MessageStatus.Seen:
        return "seen";
      case 'Failed':
      case MessageStatus.Failed:
        return "failed";
      default:
        return '';
    }
  }
}
