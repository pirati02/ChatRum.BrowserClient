import {Inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {PeerResponse} from "../models/peer.response";
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
    return this.httpClient.get<PeerResponse[]>(`${this.baseUrl}/${peerId}/requests`);
  }

  sendFriendRequest(peerId: string, requestedPeerId: string): Observable<boolean> {
    return this.httpClient.put(`${this.baseUrl}/${peerId}/request`, {
      requestedPeerId
    }).pipe(
      map(response => !!response),
    );
  }

  acceptFriendRequest(peerId: string, requestedPeerId: string) {
    return this.httpClient.put(`${this.baseUrl}/${peerId}/accept`, {
      requestedPeerId
    }).pipe(
      map(response => !!response),
    );
  }
}
