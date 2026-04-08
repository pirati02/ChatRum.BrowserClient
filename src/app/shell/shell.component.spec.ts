import { ShellComponent } from './shell.component';

describe('ShellComponent notification helpers', () => {
  const createComponent = (options?: {
    router?: any;
    notificationsService?: any;
    auth?: any;
  }) =>
    new ShellComponent(
      {} as any,
      { ensureDefaultAccountId: () => ({ subscribe: ({ next }: any) => next?.('account-1') }) } as any,
      options?.router ??
        ({
          navigate: () => Promise.resolve(true),
          url: '/',
          events: { pipe: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }) },
        } as any),
      options?.auth ?? ({ getJwtClaims: () => ({ sub: null }), logout: () => undefined } as any),
      { stopConnection: () => undefined } as any,
      { stopConnection: () => undefined } as any,
      options?.notificationsService ??
        ({
          stopConnection: () => undefined,
          startConnection: () => undefined,
          loadInitial: () => ({ subscribe: () => undefined }),
          loadUnreadCount: () => ({ subscribe: () => undefined }),
          unreadCount$: { subscribe: () => ({ unsubscribe: () => undefined }) },
          notifications$: { subscribe: () => ({ unsubscribe: () => undefined }) },
          setNotifications: () => undefined,
          setUnreadCount: () => undefined,
          markRead: () => ({ subscribe: ({ next }: any) => next?.() }),
          markAllRead: () => ({ subscribe: () => undefined }),
        } as any),
    );

  it('builds proper notification message by type', () => {
    const component = createComponent();
    const message = component.notificationMessage({
      id: '1',
      recipientId: 'r',
      actorId: 'a',
      actorDisplayName: 'Jane',
      type: 'CommentReply',
      targetId: 't',
      createdAt: new Date().toISOString(),
      isRead: false,
    });

    expect(message).toContain('replied to your comment');
  });

  it('returns relative time label', () => {
    const component = createComponent();
    const label = component.relativeTime(new Date(Date.now() - 90_000).toISOString());
    expect(label).toContain('m ago');
  });

  it('opens notification target and marks unread as read', async () => {
    const navigate = jasmine.createSpy().and.returnValue(Promise.resolve(true));
    const markRead = jasmine.createSpy().and.returnValue({
      subscribe: ({ next }: any) => next?.(),
    });
    const setUnreadCount = jasmine.createSpy();

    const component = createComponent({
      router: {
        navigate,
        url: '/',
        events: { pipe: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }) },
      },
      auth: { getJwtClaims: () => ({ sub: 'account-1' }), logout: () => undefined },
      notificationsService: {
        stopConnection: () => undefined,
        startConnection: () => undefined,
        loadInitial: () => ({ subscribe: () => undefined }),
        loadUnreadCount: () => ({ subscribe: () => undefined }),
        unreadCount$: { subscribe: () => ({ unsubscribe: () => undefined }) },
        notifications$: { subscribe: () => ({ unsubscribe: () => undefined }) },
        setNotifications: () => undefined,
        setUnreadCount,
        markRead,
        markAllRead: () => ({ subscribe: () => undefined }),
      },
    });

    component.unreadCount = 1;
    component.notifications = [
      {
        id: 'n1',
        recipientId: 'r',
        actorId: 'a',
        actorDisplayName: 'Jane',
        type: 'PostComment',
        targetId: 'post-1',
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ];

    component.openNotification(component.notifications[0]);
    await Promise.resolve();

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(navigate).toHaveBeenCalledWith(['/feed', 'account-1', 'post', 'post-1']);
    expect(setUnreadCount).toHaveBeenCalledWith(0);
  });
});
