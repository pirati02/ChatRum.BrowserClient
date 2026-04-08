import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationsService } from './notifications.service';
import { AuthService } from '../core/auth/auth.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        NotificationsService,
        { provide: 'NOTIFICATIONS_BASE_URL', useValue: 'http://localhost:7000/notifications' },
        { provide: 'NOTIFICATIONS_SIGNALR_URL', useValue: 'http://localhost:7000/hub/notifications' },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'token',
          },
        },
      ],
    });

    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads notification page', () => {
    service.loadInitial(15).subscribe((response) => {
      expect(response.items.length).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:7000/notifications' && r.params.get('pageSize') === '15');
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [{ id: 'n1' }],
      nextCursor: null,
    });
  });

  it('marks all as read', () => {
    service.markAllRead().subscribe((response) => {
      expect(response.updated).toBe(3);
    });

    const req = httpMock.expectOne('http://localhost:7000/notifications/read-all');
    expect(req.request.method).toBe('POST');
    req.flush({ updated: 3 });
  });
});
