import {HttpClient, HttpParams} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {BehaviorSubject, Observable, of} from "rxjs";
import * as signalR from "@microsoft/signalr";
import {HubConnectionState} from "@microsoft/signalr";
import {MessageRequest} from "../models/message.request";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {MessageStatus} from "../models/message.status";
import {UiMessage} from "../routes/conversation/conversation.component";
import {ConversationResponse} from "../models/conversation.response";
import {LastConversationResponse} from "../models/last-conversation.response";

@Injectable({
  providedIn: 'root'
})
export class ConversationService {

  private hubConnection!: signalR.HubConnection;
  private conversationCreatedSubject = new BehaviorSubject<string | null>(null);
  private conversationAppendMessageSubject = new BehaviorSubject<{
    message: UiMessage,
    update: boolean
  } | null>(null);
  private updateMessageStateSubject = new BehaviorSubject<{ messageId: string, status: MessageStatus } | null>(null);

  conversationAppendMessage$ = this.conversationAppendMessageSubject.asObservable();
  updateMessageState$ = this.updateMessageStateSubject.asObservable();

  constructor(
    @Inject('CHAT_BASE_URL') private baseUrl: string,
    @Inject('SIGNALR_URL') private signalrUrl: string,
    private httpClient: HttpClient
  ) {

  }

  startConnection(accountId: string) {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.signalrUrl}?accountId=${accountId}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connected'))
      .catch(err => console.error('SignalR Connection Error: ', err));

    this.hubConnection.on('ConversationStarted', (conversationId: string) => {
      this.conversationCreatedSubject.next(conversationId);
    });

    this.hubConnection.on('MessageSent', (message: UiMessage, update: boolean) => {
      this.conversationAppendMessageSubject.next({message, update});
    });

    this.hubConnection.on('MessageStateUpdated', (messageId: string, status: MessageStatus) => {
      this.updateMessageStateSubject.next({messageId, status});
    })
  }

  stopConnection() {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => console.log('SignalR Disconnected'))
        .catch(err => console.error('Error while disconnecting SignalR:', err));
    }
  }

  startConversation(sender: string, receiver: string, message: MessageRequest | null = null): Observable<any> {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('StartConversation', sender, receiver, message))
    }

    return of(null);
  }

  sendMessage(conversationId: string, message: MessageRequest) {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('SendMessage', conversationId, message))
    }

    return of(null);
  }

  updateMessageStatus(message: UiMessage, messageStatus: MessageStatus) {
    if (this.hubConnection?.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('UpdateMessageState', message.conversationId, message, messageStatus))
    }

    return of(null);
  }

  findConversation(me: string, participantId: string): Observable<ConversationResponse> {
    return this.httpClient
      .get<ConversationResponse>(this.baseUrl + `/existing/${me}/${participantId}`)
  }

  markAsRead(conversationId: string, messageIds: string[]) {
    return this.httpClient
      .post<boolean>(this.baseUrl + `/mark-as-read/${conversationId}`, messageIds);
  }

  findTop10Conversation(accountId: string, friendIds: string[]): Observable<LastConversationResponse[]> {
    let params = new HttpParams();
    friendIds.forEach(id => {
      params = params.append('ids', id);
    });
    return this.httpClient.get<LastConversationResponse[]>(this.baseUrl + `/${accountId}/top10`, {
      params: params
    })
  }
}
