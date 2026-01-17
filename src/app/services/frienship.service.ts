import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {PeerResponse} from "../models/peer.response";
import {Peer} from "../models/peer";
import {map, Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class FriendshipService {
  constructor(
    @Inject('FRIENDSHIP_BASE_URL') private baseUrl: string,
    private httpClient: HttpClient) {
  }

  getFriends(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(`${this.baseUrl}/${peerId}`);
  }

  getFriendRequests(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(`${this.baseUrl}/${peerId}/received-requests`);
  }

  getFriendRequestsISent(peerId: string): Observable<PeerResponse[]> {
    return this.httpClient.get<PeerResponse[]>(`${this.baseUrl}/${peerId}/sent-requests`);
  }

  sendFriendRequest(peer1: Peer, peer2: Peer): Observable<boolean> {
    return this.httpClient.post(`${this.baseUrl}/request`, {
      peer1,
      peer2
    }).pipe(
      map(response => !!response),
    );
  }

  acceptFriendRequest(peer1: Peer, peer2: Peer) {
    return this.httpClient.post(`${this.baseUrl}/accept`, {
      peer1,
      peer2
    }).pipe(
      map(response => !!response),
    );
  }

  unfriendRequest(peer1: Peer, peer2: Peer) {
    return this.httpClient.delete(`${this.baseUrl}/unfriend`, {
      body: {
        peer1,
        peer2
      }
    });
  }
}
