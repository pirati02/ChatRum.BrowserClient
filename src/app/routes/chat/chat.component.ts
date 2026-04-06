import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../services/chat.service';
import {
  catchError,
  delay,
  EMPTY,
  from,
  mergeMap,
  Observable,
  of,
  skip,
  Subject,
  Subscription,
  takeUntil,
  tap,
  switchMap,
  map,
} from 'rxjs';
import { MessageRequest } from '../../models/message.request';
import { MessageResponse } from '../../models/message.response';
import { MessageStatus } from '../../models/message.status';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiError } from '../../models/api.error';
import { ErrorType } from '../../models/error.types';
import { Participant } from '../../models/participant';
import { Account } from '../../models/account';
import { MatDialog } from '@angular/material/dialog';
import {
  ChatDetailsComponent,
  ChatDetailsData,
} from '../chat-details/chat-details.component';
import { ChatResponse } from '../../models/chat.response';
import {
  AttachmentContent,
  PlainTextContent,
} from '../../models/message.content';
import { normalizeMessageContent } from '../../models/message-content.mapper';
import { HelperService } from '../../services/helper.service';
import {
  SendFileEvent,
  SendMessageEvent,
} from './message-input/message-input.component';
import { AccountsService } from '../../services/accounts.service';
import { SelectedAccountService } from '../../services/selected-account.service';
import { LastChatResponse } from '../../models/last-chat.response';
import { LastestMessage } from '../../models/latest-message.response';
import { MessageReaction, MessageReactionEmoji } from '../../models/message-reaction';

export type uiStatus = 'sent' | 'seen' | 'delivered' | 'failed' | '';

export interface UiMessage extends MessageResponse {
  statusString: string;
}

interface Chat {
  chatId: string | null;
  messages: UiMessage[];
  participants?: Participant[];
  creator: Participant | null;
  createdDate: string | null;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollElement') scrollContainer?: ElementRef<HTMLDivElement>;
  chat: Chat = <Chat>{
    chatId: null,
    messages: [],
    participants: [],
    creator: null,
    createdDate: null,
  };

  me?: Participant;
  recentChats: LastChatResponse[] = [];
  /** Slide-out panel for recent conversations; list still loads when closed. */
  conversationsDrawerOpen = false;
  overrideExisting: boolean = false;
  private subscriptions: Subscription[] = [];
  private startNewChat: boolean = false;
  private meAccount?: Account;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private helperService: HelperService,
    private accountsService: AccountsService,
    private selectedAccount: SelectedAccountService,
  ) {}

  ngOnInit() {
    this.gatherChatInfo()
      .pipe(
        tap(() => {
          this.chatService.startConnection(this.me?.id!);
          this.loadRecentConversations();
        }),
        delay(1000),
        mergeMap(() => this.loadChatContent()),
      )
      .subscribe();

    this.activatedRoute.queryParamMap
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.meAccount) {
          return;
        }
        this.resetChatStateForRouteChange();
        this.bootstrapChatFromMeAccount(
          this.meAccount,
          this.activatedRoute.snapshot.queryParamMap,
        );
        this.loadChatContent().subscribe(() => this.scrollToBottom());
      });

    this.startListeners();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.chatService.stopConnection();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onSendMessage(event: SendMessageEvent) {
    const content = event.content?.trim();
    if (!content) return;

    const messageContent: PlainTextContent = this.helperService.isLink(content)
      ? ({ type: 'link', $type: 'link', content } as any as PlainTextContent)
      : { type: 'plain', $type: 'plain', content };

    this.dispatchMessage({
      sender: this.me!,
      content: messageContent,
      replyOf: null,
    });
  }

  onSendFile(event: SendFileEvent) {
    if (!event.file) return;

    this.chatService.uploadAttachment(event.file).subscribe((uploaded) => {
      this.dispatchMessage({
        sender: this.me!,
        content: <AttachmentContent>{
          type: 'attachment',
          $type: 'attachment',
          content: uploaded.url,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        },
        replyOf: null,
      });
    });
  }

  onToggleReaction(event: { message: UiMessage; emoji: MessageReactionEmoji }) {
    if (!this.chat.chatId || !this.me?.id) {
      return;
    }

    this.chatService
      .updateMessageReaction(
        this.chat.chatId,
        event.message.messageId,
        this.me,
        event.emoji,
      )
      .subscribe();
  }

  private dispatchMessage(message: MessageRequest) {
    const send$ = this.chat.chatId
      ? this.chatService.sendMessage(this.chat.chatId, message)
      : this.startChatInternal().pipe(
          mergeMap(() =>
            this.chatService.sendMessage(this.chat.chatId!, message),
          ),
        );

    send$.subscribe(() => this.scrollToBottom());
  }

  openChatDetails() {
    this.dialog.open(ChatDetailsComponent, {
      width: '400px',
      data: <ChatDetailsData>{
        participants: this.chat.participants,
        creator: this.chat.creator,
        createdDate: this.chat.createdDate,
      },
    });
  }

  retryMessage(message: UiMessage) {
    if (!this.chat.chatId) return;

    message.status = MessageStatus.Sent;
    message.statusString = this.statusString(MessageStatus.Sent);

    this.chatService
      .sendMessage(this.chat.chatId, {
        sender: message.sender,
        content: message.content,
        replyOf: message.replyOf,
      })
      .subscribe();
  }

  getReceiver(id: string): Participant | undefined {
    return this.chat?.participants?.find((p) => p.id === id);
  }

  getChatHeaderTitle(): string {
    const others =
      this.chat.participants?.filter((p) => p.id !== this.me?.id) ?? [];
    if (others.length === 0) {
      return 'Select a friend';
    }
    if (others.length === 1) {
      return others[0].nickName;
    }
    return others.map((p) => p.nickName).join(', ');
  }

  conversationTitle(chat: LastChatResponse): string {
    const others =
      chat.participants?.filter((p) => p.id !== this.me?.id) ?? [];
    if (others.length === 0) {
      return 'Chat';
    }
    if (others.length === 1) {
      return others[0].nickName;
    }
    return others.map((p) => p.nickName).join(', ');
  }

  messagePreview(chat: LastChatResponse): string {
    const content = chat.message?.content;
    if (!content) {
      return '';
    }
    if (content.type === 'attachment') {
      return 'Attachment';
    }
    return content.content ?? '';
  }

  isActiveConversation(chat: LastChatResponse): boolean {
    return (
      !!this.chat.chatId && this.chat.chatId === chat.chatId
    );
  }

  toggleConversationsDrawer(): void {
    this.conversationsDrawerOpen = !this.conversationsDrawerOpen;
  }

  closeConversationsDrawer(): void {
    this.conversationsDrawerOpen = false;
  }

  openRecentChat(chat: LastChatResponse): void {
    const selectedFriends = chat.participants
      .filter((p) => p.id !== this.me?.id)
      .map(
        (friend) =>
          <Account>{
            id: friend.id,
            firstName: friend.firstName,
            lastName: friend.lastName,
            userName: friend.nickName,
            isVerified: true,
          },
      );

    this.closeConversationsDrawer();

    void this.router.navigate(['chat'], {
      queryParams: {
        chatId: chat.chatId,
        receivers: JSON.stringify(selectedFriends),
      },
    });
  }

  private loadRecentConversations(): void {
    if (!this.me?.id) {
      return;
    }
    this.chatService
      .findTop10Conversation(this.me.id)
      .pipe(
        catchError((err) => {
          console.warn('Recent conversations failed to load', err);
          return of([] as LastChatResponse[]);
        }),
      )
      .subscribe((chats) => {
        this.recentChats = chats.filter((c) => !!c.message);
      });
  }

  private resetChatStateForRouteChange(): void {
    this.chat = {
      chatId: null,
      messages: [],
      participants: [],
      creator: null,
      createdDate: null,
    };
  }

  private loadChatContent(): Observable<unknown> {
    if (this.overrideExisting) {
      return of(null);
    }

    if (this.chat.chatId) {
      return this.chatService
        .getChat(this.chat.chatId)
        .pipe(switchMap((res) => this.initializeChat(res)));
    }

    if (this.startNewChat) {
      this.overrideExisting = this.startNewChat;
      return this.startChatInternal().pipe(tap(() => this.scrollToBottom()));
    }

    return this.chatService.findChat(this.chat?.participants!).pipe(
      switchMap((res) => this.initializeChat(res)),
      catchError((err) => {
        let apiErrors: ApiError[] = [];

        if (err.error) {
          apiErrors = Array.isArray(err.error) ? err.error : [err.error];
        }

        const convNotFound = apiErrors.find(
          (e) => e.type === ErrorType.NotFound,
        );
        if (convNotFound) {
          this.startChatInternal().subscribe(() => this.scrollToBottom());
        }

        return of(null);
      }),
    );
  }

  private initializeChat(res: ChatResponse): Observable<void> {
    this.chat = {
      ...res,
      messages: [],
      participants: res.participants,
      creator: res.creator,
      createdDate: res.createdDate,
    };

    if (res.messages.length === 0) {
      this.markUnreadMessagesAsSeen();
      return of(undefined);
    }

    return from(res.messages).pipe(
      map((m) => this.toUiMessage(m)),
      tap((uiMessage) => {
        this.chat.messages.push(uiMessage);
      }),
      map(() => undefined),
      tap({
        complete: () => this.markUnreadMessagesAsSeen(),
      }),
    );
  }

  private toUiMessage(message: MessageResponse): UiMessage {
    return {
      ...message,
      content: normalizeMessageContent(message.content),
      reactions: message.reactions ?? [],
      statusString: this.statusString(message.status),
    };
  }

  private markUnreadMessagesAsSeen() {
    const otherParticipantIds =
      this.chat.participants
        ?.filter((p) => p.id !== this.me?.id)
        .map((p) => p.id) ?? [];

    const unreadMessages = this.chat.messages.filter(
      (m) =>
        [MessageStatus.Sent, MessageStatus.Delivered].includes(m.status) &&
        otherParticipantIds.includes(m.sender.id),
    );

    if (unreadMessages.length === 0) return;

    this.chatService
      .markAsRead(
        this.chat.chatId!,
        unreadMessages.map((m) => m.messageId),
      )
      .subscribe((success) => {
        if (success) {
          this.chat.messages.forEach((m) => {
            m.status = MessageStatus.Seen;
            m.statusString = this.statusString(MessageStatus.Seen);
          });
        }
      });
  }

  private startChatInternal() {
    const chatName =
      this.chat.participants?.length! > 2
        ? this.chat?.participants!.map((p) => p.nickName).join(', ')
        : this.chat?.participants!.find((p) => p.id !== this.me?.id)?.nickName;

    return this.chatService.startChat(
      this.chat?.participants!!,
      this.me!,
      chatName!,
      this.overrideExisting,
    );
  }

  /**
   * Read route state once. Do not subscribe to `queryParams` without `take(1)`:
   * repeated emissions would cancel the inner `switchMap` pipeline and abort `getChat`.
   */
  private gatherChatInfo(): Observable<void> {
    const params = this.activatedRoute.snapshot.queryParamMap;
    return this.resolveMeAccountFromSelection().pipe(
      tap((account) => this.bootstrapChatFromMeAccount(account, params)),
      map(() => undefined),
    );
  }

  private bootstrapChatFromMeAccount(meAccount: Account, params: ParamMap): void {
    this.meAccount = meAccount;
    this.me = this.toParticipant(meAccount);
    this.startNewChat = params.get('newChat') === 'true';
    this.overrideExisting = params.get('overrideExisting') === 'true';

    const receiversJson = params.get('receivers');
    const receivers: Account[] = receiversJson
      ? (JSON.parse(receiversJson) as Account[]).filter(
          (r) => r.id !== meAccount.id,
        )
      : [];

    this.chat = {
      ...this.chat,
      chatId: params.get('chatId'),
      participants: [
        ...this.chat.participants!,
        ...receivers.map((r) => this.toParticipant(r)),
        this.me,
      ],
    };
  }

  /** Resolve current user from selected/default account (never from query params). */
  private resolveMeAccountFromSelection(): Observable<Account> {
    const id = this.selectedAccount.getSelectedAccountId();
    const load$ = id
      ? this.accountsService.loadAccount(id)
      : this.accountsService.ensureDefaultAccountId(this.selectedAccount).pipe(
          switchMap((resolved) => {
            if (!resolved) {
              void this.router.navigate(['/']);
              return EMPTY;
            }
            return this.accountsService.loadAccount(resolved);
          }),
        );
    return load$.pipe(
      catchError(() => {
        void this.router.navigate(['/']);
        return EMPTY;
      }),
    );
  }

  private toParticipant(account: Account): Participant {
    return {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      nickName: account.userName,
      isAdmin: false,
    };
  }

  private startListeners() {
    this.subscriptions.push(
      this.chatService.chatStarted$.subscribe(
        (res) => (this.chat.chatId = res!),
      ),
      this.chatService.updateMessageState$.subscribe((result) =>
        this.handleMessageStateUpdate(result),
      ),
      this.chatService.chatAppendMessage$.subscribe((result) =>
        this.handleNewMessage(result),
      ),
      this.chatService.messageFailed$.subscribe((result) =>
        this.handleMessageFailed(result),
      ),
      this.chatService.updateMessageReaction$.subscribe((result) =>
        this.handleMessageReactionUpdate(result),
      ),
    );
  }

  private handleMessageStateUpdate(
    result: { messageId: string; status: MessageStatus } | null,
  ) {
    if (!result?.messageId) return;

    const message = this.chat.messages.find(
      (item) => item.messageId === result.messageId,
    );
    if (message) {
      message.status = result.status;
      message.statusString = this.statusString(result.status);
    }
  }

  private handleNewMessage(
    result: { message: UiMessage; update: boolean } | null,
  ) {
    if (!result?.message) return;
    if (
      this.chat.messages.some((m) => m.messageId === result.message.messageId)
    )
      return;

    const uiMessage = this.toUiMessage(result.message);
    this.chat.messages.push(uiMessage);
    this.updateRecentChatPreview(uiMessage);

    if (result.update) {
      this.chatService.updateMessageStatus(
        uiMessage,
        MessageStatus.Seen,
      );
    }
    this.scrollToBottom();
  }

  private handleMessageFailed(result: UiMessage | null) {
    if (!result) return;

    const message = this.chat.messages.find(
      (item) => item.messageId === result.messageId,
    );
    if (message) {
      message.status = MessageStatus.Failed;
      message.statusString = this.statusString(MessageStatus.Failed);
    } else {
      result.status = MessageStatus.Failed;
      result.statusString = this.statusString(MessageStatus.Failed);
      this.chat.messages.push({
        ...result,
        content: normalizeMessageContent(result.content),
      });
      this.scrollToBottom();
    }
  }

  private handleMessageReactionUpdate(
    result: { messageId: string; reactions: MessageReaction[] } | null,
  ) {
    if (!result?.messageId) return;
    const message = this.chat.messages.find((m) => m.messageId === result.messageId);
    if (!message) {
      return;
    }

    message.reactions = result.reactions ?? [];
  }

  private updateRecentChatPreview(message: UiMessage): void {
    const row = this.recentChats.find((c) => c.chatId === message.chatId);
    if (!row) {
      return;
    }
    row.message = <LastestMessage>{
      content: message.content,
      sender: message.sender,
      chatId: message.chatId,
      messageId: message.messageId,
    };
  }

  private scrollToBottom(): void {
    this.ngZone.run(() => {
      const scrollContainer = this.scrollContainer!.nativeElement;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
  }

  private statusString(
    status: 'Seen' | 'Sent' | 'Delivered' | 'Failed' | MessageStatus,
  ): uiStatus {
    switch (status) {
      case 'Sent':
      case MessageStatus.Sent:
        return 'sent';
      case 'Delivered':
      case MessageStatus.Delivered:
        return 'delivered';
      case 'Seen':
      case MessageStatus.Seen:
        return 'seen';
      case 'Failed':
      case MessageStatus.Failed:
        return 'failed';
      default:
        return '';
    }
  }
}
