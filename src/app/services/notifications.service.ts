import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { BehaviorSubject, Observable } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { NotificationItem, NotificationPageResponse, UnreadCountResponse } from '../models/notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private hubConnection!: signalR.HubConnection;
  private notificationsSubject = new BehaviorSubject<NotificationItem[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  notifications$ = this.notificationsSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    @Inject('NOTIFICATIONS_BASE_URL') private baseUrl: string,
    @Inject('NOTIFICATIONS_SIGNALR_URL') private signalrUrl: string,
    private httpClient: HttpClient,
    private auth: AuthService,
  ) {}

  startConnection(accountId: string): void {
    const token = this.auth.getAccessToken();
    if (!token || this.hubConnection?.state === signalR.HubConnectionState.Connected) {
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
      .catch((err) => console.error('Notifications SignalR Connection Error:', err));

    this.hubConnection.on('NotificationCreated', (notification: NotificationItem) => {
      const current = this.notificationsSubject.getValue();
      this.notificationsSubject.next([notification, ...current]);
    });

    this.hubConnection.on('NotificationUnreadCountChanged', (unreadCount: number) => {
      this.unreadCountSubject.next(unreadCount ?? 0);
    });
  }

  stopConnection(): void {
    if (!this.hubConnection) {
      return;
    }

    this.hubConnection.stop().catch((err) => console.error('Notifications SignalR disconnect error:', err));
  }

  loadInitial(pageSize: number = 20): Observable<NotificationPageResponse> {
    const params = new HttpParams().set('pageSize', pageSize.toString());
    return this.httpClient.get<NotificationPageResponse>(this.baseUrl, { params });
  }

  loadUnreadCount(): Observable<UnreadCountResponse> {
    return this.httpClient.get<UnreadCountResponse>(`${this.baseUrl}/unread-count`);
  }

  markRead(notificationId: string): Observable<void> {
    return this.httpClient.post<void>(`${this.baseUrl}/${notificationId}/read`, {});
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.httpClient.post<{ updated: number }>(`${this.baseUrl}/read-all`, {});
  }

  setNotifications(items: NotificationItem[]): void {
    this.notificationsSubject.next(items ?? []);
  }

  setUnreadCount(unreadCount: number): void {
    this.unreadCountSubject.next(unreadCount ?? 0);
  }

  private buildHubUrl(accountId: string): string {
    const token = this.auth.getAccessToken() ?? '';
    const params = new URLSearchParams({ accountId });
    if (token) {
      params.set('access_token', token);
    }

    return `${this.signalrUrl}?${params.toString()}`;
  }
}
