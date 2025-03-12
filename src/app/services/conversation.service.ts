import {HttpClient} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {BehaviorSubject, Observable, of} from "rxjs";
import * as signalR from "@microsoft/signalr";
import {HubConnectionState} from "@microsoft/signalr";
import {MessageRequest} from "../models/message.request";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {MessageStatus} from "../models/message.status";
import {UiMessage} from "../routes/conversation/conversation.component";

@Injectable({
  providedIn: 'root'
})
export class ConversationService {

  private hubConnection!: signalR.HubConnection;
  private conversationCreatedSubject = new BehaviorSubject<string | null>(null);
  private conversationAppendMessageSubject = new BehaviorSubject<UiMessage | null>(null);
  private updateMessageStateSubject = new BehaviorSubject<{ messageId: string, status: MessageStatus } | null>(null);

  // Expose an observable to listen for new conversations
  conversationCreated$ = this.conversationCreatedSubject.asObservable();
  conversationAppendMessage$ = this.conversationAppendMessageSubject.asObservable();
  updateMessageState$ = this.updateMessageStateSubject.asObservable();

  constructor(
    @Inject('CHAT_BASE_URL') private baseUrl: string,
    @Inject('SIGNALR_URL') private signalrUrl: string,
    private httpClient: HttpClient
  ) {

  }

  startConnection(conversationId?: string) {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.signalrUrl}?conversationId=${conversationId}`) // Replace with your actual backend URL
      .withAutomaticReconnect() // Enables auto-reconnect
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connected'))
      .catch(err => console.error('SignalR Connection Error: ', err));

    this.hubConnection.on('ConversationStarted', (conversationId: string) => {
      this.conversationCreatedSubject.next(conversationId);
    });

    this.hubConnection.on('MessageSent', (conversationId: string, message: UiMessage) => {
      this.conversationAppendMessageSubject.next(message);
      this.updateMessageStatus(message, MessageStatus.Delivered);
    });

    this.hubConnection.on('MessageStateUpdated', (conversationId: string, messageId: string, status: MessageStatus) => {
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

  startConversation(conversationId: string | null, participantId1: string, participantId2: string, message: MessageRequest): Observable<any> {
    if (this.hubConnection.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('StartConversation', conversationId, participantId1, participantId2, message))
    }

    return of(null);
  }

  sendMessage(conversationId: string, message: MessageRequest) {
    if (this.hubConnection.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('SendMessage', conversationId, message))
    }

    return of(null);
  }

  updateMessageStatus(message: UiMessage, messageStatus: MessageStatus) {
    if (this.hubConnection.state == HubConnectionState.Connected) {
      return fromPromise(this.hubConnection.invoke('UpdateMessageState', message.conversationId, message, messageStatus))
    }

    return of(null);
  }

  findConversation(me: string, participantId: string) {
    return this.httpClient
      .get<{
        conversationId: string;
        messages: UiMessage[]
      }>(this.baseUrl + `/existing/${me}/${participantId}`)
  }

  markAsRead(conversationId: string, messageIds: string[]) {
    return this.httpClient
      .post<boolean>(this.baseUrl + `/mark-as-read/${conversationId}`, messageIds);
  }
}
