import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {ChatService} from "../../services/chat.service";
import {catchError, delay, mergeMap, Observable, of, tap} from "rxjs";
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

export type uiStatus = 'sent' | 'seen' | 'delivered' | ''

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
  chatGroup$?: FormGroup<{
    messageContent: FormControl<string | null>
  }>;
  chat: Chat = <Chat>{
    chatId: null,
    messages: [],
    participants: [],
    creator: null,
    createdDate: null
  };

  me?: Participant;
  overrideExisting: boolean = false;
  private messagePlaceholderDefault: string = "Type a message...";
  messagePlaceholder: string = this.messagePlaceholderDefault;
  private selectedFile?: File;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private chatService: ChatService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private helperService: HelperService
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
                  this.startChatInternal().subscribe(() => this.cleanupMessageContent());
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
  }

  sendMessage() {
    if (this.selectedFile) {
      this.sendFileMessage();
      return;
    }


    const content = this.chatGroup$?.controls.messageContent?.value!;
    if (!content?.trim()) {
      return;
    }

    let message: MessageRequest = {
      sender: this.me!,
      content: <PlainTextContent>{ type: 'plain', content: content },
      replyOf: null
    };

    if (this.helperService.isLink(content)){
      message = {
        ...message,
        content: <MessageContent>{
          type: 'link',
          content: content,
        }
      };
    }

    if (!this.chat.chatId) {
      this.startChatInternal()
        .pipe(
          tap(() => this.chatService.sendMessage(this.chat.chatId!, message)
            .subscribe(() => this.cleanupMessageContent()))
        ).subscribe();
    } else {
      this.chatService.sendMessage(this.chat.chatId!, message)
        .subscribe(() => this.cleanupMessageContent());
    }
  }

  sendFileMessage() {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const message: MessageRequest = {
        sender: this.me!,
        content: <ImageContent>{ type: 'image', content: base64 },
        replyOf: null
      };

      if (!this.chat.chatId) {
        this.startChatInternal()
          .pipe(
            tap(() => this.chatService.sendMessage(this.chat.chatId!, message)
              .subscribe(() => this.cleanupFileMessage()))
          ).subscribe();
      } else {
        this.chatService.sendMessage(this.chat.chatId!, message)
          .subscribe(() => this.cleanupFileMessage());
      }
    };

    reader.readAsDataURL(this.selectedFile);
  }

  onFileSelected($event: Event) {
    const target = $event.target as HTMLInputElement;
    const file: File = Array.from(target.files!)[0];
    this.messagePlaceholder = file.name;
    this.selectedFile = file;
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

  getReceiver(id: string): Participant | undefined {
    return this.chat?.participants?.find(p => p.id === id);
  }

  private initializeChat(res: ChatResponse) {
    this.chat = {
      ...res,
      messages: res.messages.map(item => {
        item.statusString = this.statusString(item.status);
        return item;
      }),
      participants: res.participants,
      creator: res.creator,
      createdDate: res.createdDate
    };

    const others = this.chat?.participants!.filter(p => p.id !== this.me?.id)?.map(a => a.id)!;
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

        this.me = <Participant>{
          id: me.id,
          firstName: me.firstName,
          lastName: me.lastName,
          nickName: me.userName
        };

        this.overrideExisting = params["overrideExisting"] == "true" || false;
        this.chat = {
          ...this.chat,
          chatId: params["chatId"],
          participants: [
            ...this.chat.participants!,
            ...receivers.map(receiver => <Participant>{
              id: receiver.id,
              firstName: receiver.firstName,
              lastName: receiver.lastName,
              nickName: receiver.userName
            }),
            ...[this.me]]
        }
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
      if (!result)
        return;

      if (result.message) {
        if (this.chat.messages.some(a => a.messageId === result?.message.messageId)) {
          return;
        }

        result.message.statusString = this.statusString(result!.message?.status);
        this.chat.messages.push(result.message);
        if (result.update) {
          this.chatService.updateMessageStatus(result.message, MessageStatus.Seen);
        }
        this.scrollToBottom();
      }
    });
  }

  private cleanupMessageContent() {
    this.chatGroup$?.controls.messageContent.patchValue('');
    this.scrollToBottom();
  }

  private cleanupFileMessage() {
    this.selectedFile = undefined;
    this.messagePlaceholder = this.messagePlaceholderDefault;
    this.cleanupMessageContent();
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
