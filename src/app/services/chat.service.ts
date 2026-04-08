import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { HubConnectionState } from '@microsoft/signalr';
import { MessageRequest } from '../models/message.request';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { MessageStatus } from '../models/message.status';
import { UiMessage } from '../routes/chat/chat.component';
import { ChatResponse } from '../models/chat.response';
import { LastChatResponse } from '../models/last-chat.response';
import { Participant } from '../models/participant';
import { MessageReaction, MessageReactionEmoji } from '../models/message-reaction';

export interface UploadedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private hubConnection!: signalR.HubConnection;
  private chatCreatedSubject = new BehaviorSubject<string | null>(null);
  private chatAppendMessageSubject = new BehaviorSubject<{
    message: UiMessage;
    update: boolean;
  } | null>(null);
  private updateMessageStateSubject = new BehaviorSubject<{
    messageId: string;
    status: MessageStatus;
  } | null>(null);
  private messageFailedSubject = new BehaviorSubject<UiMessage | null>(null);
  private updateMessageReactionSubject = new BehaviorSubject<{
    messageId: string;
    reactions: MessageReaction[];
  } | null>(null);

  chatAppendMessage$ = this.chatAppendMessageSubject.asObservable();
  updateMessageState$ = this.updateMessageStateSubject.asObservable();
  messageFailed$ = this.messageFailedSubject.asObservable();
  updateMessageReaction$ = this.updateMessageReactionSubject.asObservable();
  chatStarted$ = this.chatCreatedSubject.asObservable();

  constructor(
    @Inject('CHAT_BASE_URL') private baseUrl: string,
    @Inject('CHAT_SIGNALR_URL') private signalrUrl: string,
    private httpClient: HttpClient,
    private auth: AuthService,
  ) {}

  startConnection(accountId: string) {
    const token = this.auth.getAccessToken();
    if (!token) {
      console.warn('Chat SignalR: no access token; connection not started');
      return;
    }
    if (
      this.hubConnection &&
      (this.hubConnection.state === signalR.HubConnectionState.Connected ||
        this.hubConnection.state === signalR.HubConnectionState.Connecting ||
        this.hubConnection.state === signalR.HubConnectionState.Reconnecting)
    ) {
      return;
    }
    const hubUrl = this.buildHubUrl(accountId);
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => Promise.resolve(this.auth.getAccessToken() ?? ''),
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connected'))
      .catch((err) => console.error('SignalR Connection Error: ', err));

    this.hubConnection.on('ChatStarted', (chatId: string) => {
      this.chatCreatedSubject.next(chatId);
    });

    this.hubConnection.on('MessageFailed', (message: UiMessage) => {
      this.messageFailedSubject.next(message);
    });

    this.hubConnection.on(
      'MessageSent',
      (message: UiMessage, update: boolean) => {
        this.chatAppendMessageSubject.next({ message, update });
      },
    );

    this.hubConnection.on(
      'MessageStateUpdated',
      (messageId: string, status: MessageStatus) => {
        this.updateMessageStateSubject.next({ messageId, status });
      },
    );

    this.hubConnection.on(
      'MessageReactionUpdated',
      (messageId: string, reactions: MessageReaction[]) => {
        this.updateMessageReactionSubject.next({
          messageId,
          reactions: reactions ?? [],
        });
      },
    );
  }

  private buildHubUrl(accountId: string): string {
    const token = this.auth.getAccessToken() ?? '';
    const params = new URLSearchParams({ accountId });
    if (token) {
      params.set('access_token', token);
    }
    return `${this.signalrUrl}?${params.toString()}`;
  }

  stopConnection() {
    if (this.hubConnection) {
      this.hubConnection
        .stop()
        .then(() => console.log('SignalR Disconnected'))
        .catch((err) =>
          console.error('Error while disconnecting SignalR:', err),
        );
    }
  }

  startChat(
    participants: Participant[],
    creator: Participant,
    chatName: string,
    overrideExisting: boolean = false,
  ): Observable<any> {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(
        this.hubConnection.invoke(
          'StartChat',
          participants,
          creator,
          chatName,
          overrideExisting,
        ),
      );
    }

    return of(null);
  }

  sendMessage(chatId: string, message: MessageRequest) {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(
        this.hubConnection.invoke('SendMessage', chatId, message),
      );
    }

    return of(null);
  }

  uploadAttachment(file: File): Observable<UploadedAttachment> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.httpClient.post<UploadedAttachment>(
      this.baseUrl + `/attachments`,
      formData,
    );
  }

  updateMessageStatus(message: UiMessage, messageStatus: MessageStatus) {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(
        this.hubConnection.invoke(
          'UpdateMessageState',
          message.chatId,
          message,
          messageStatus,
        ),
      );
    }

    return of(null);
  }

  updateMessageReaction(
    chatId: string,
    messageId: string,
    actor: Participant,
    emoji: MessageReactionEmoji,
  ) {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(
        this.hubConnection.invoke('UpdateMessageReaction', chatId, {
          messageId,
          actor,
          emoji,
        }),
      );
    }

    return of(null);
  }

  findChat(participants: Participant[]): Observable<ChatResponse> {
    return this.httpClient.post<ChatResponse>(
      this.baseUrl + `/search-existing`,
      participants,
    );
  }

  getChat(chatId: string): Observable<ChatResponse> {
    return this.httpClient.get<ChatResponse>(this.baseUrl + `/${chatId}`);
  }

  markAsRead(chatId: string, messageIds: string[]) {
    return this.httpClient.post<boolean>(
      this.baseUrl + `/mark-as-read/${chatId}`,
      messageIds,
    );
  }

  findTop10Conversation(
    accountId: string,
    friendIds: string[] = [],
  ): Observable<LastChatResponse[]> {
    let params = new HttpParams();
    friendIds.forEach((id) => {
      params = params.append('ids', id);
    });
    return this.httpClient.get<LastChatResponse[]>(
      this.baseUrl + `/${accountId}/top10`,
      {
        params: params,
      },
    );
  }
}
