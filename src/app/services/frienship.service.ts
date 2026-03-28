import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth/auth.service';
import { PeerResponse } from '../models/peer.response';
import { Peer } from '../models/peer';
import { BehaviorSubject, map, Observable } from 'rxjs';
import * as signalR from '@microsoft/signalr';

@Injectable({
  providedIn: 'root',
})
export class FriendshipService {
  private hubConnection!: signalR.HubConnection;

  private friendRequestReceivedSubject = new BehaviorSubject<{
    fromPeerId: Peer;
    toPeerId: Peer;
  } | null>(null);
  private friendRequestAcceptedSubject = new BehaviorSubject<{
    fromPeerId: Peer;
    toPeerId: Peer;
  } | null>(null);

  friendRequestReceived$ = this.friendRequestReceivedSubject.asObservable();
  friendRequestAccepted$ = this.friendRequestAcceptedSubject.asObservable();

  constructor(
    @Inject('FRIENDSHIP_BASE_URL') private baseUrl: string,
    @Inject('FRIENDSHIP_SIGNALR_URL') private signalrUrl: string,
    private httpClient: HttpClient,
    private auth: AuthService,
  ) {}

  startConnection(accountId: string) {
    const token = this.auth.getAccessToken();
    if (!token) {
      console.warn('Friendship SignalR: no access token; connection not started');
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

    this.hubConnection.on(
      'FriendRequestReceived',
      (fromPeerId: Peer, toPeerId: Peer) => {
        this.friendRequestReceivedSubject.next({ fromPeerId, toPeerId });
      },
    );

    this.hubConnection.on(
      'FriendRequestAccepted',
      (fromPeerId: Peer, toPeerId: Peer) => {
        this.friendRequestAcceptedSubject.next({ fromPeerId, toPeerId });
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

  getFriends(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(`${this.baseUrl}/${peerId}`);
  }

  getFriendRequests(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(
      `${this.baseUrl}/${peerId}/received-requests`,
    );
  }

  getFriendRequestsISent(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(
      `${this.baseUrl}/${peerId}/sent-requests`,
    );
  }

  sendFriendRequest(peer1: Peer, peer2: Peer): Observable<boolean> {
    return this.httpClient
      .post(`${this.baseUrl}/request`, {
        peer1,
        peer2,
      })
      .pipe(map((response) => !!response));
  }

  acceptFriendRequest(peer1: Peer, peer2: Peer) {
    return this.httpClient
      .post(`${this.baseUrl}/accept`, {
        peer1,
        peer2,
      })
      .pipe(map((response) => !!response));
  }

  unfriendRequest(peer1: Peer, peer2: Peer) {
    return this.httpClient.delete(`${this.baseUrl}/unfriend`, {
      body: {
        peer1,
        peer2,
      },
    });
  }
}
