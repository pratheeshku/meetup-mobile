/**
 * Bell unread count: one store, server-sourced (NB-02), kept on failure (NB-05),
 * cleared on sign-out without a late response resurrecting it (NB-04), and a
 * refresh after a change is never answered by a read that started before it (NB-03).
 */
import { getUnreadCount } from '../../api/notifications';
import {
  adjustUnreadBadgeCount,
  getUnreadBadgeCount,
  setUnreadBadgeCount,
} from '../../notifications/unreadCountStore';
import { refreshUnreadCount, resetUnreadCount } from '../useUnreadCount';

jest.mock('../../api/notifications', () => ({ getUnreadCount: jest.fn() }));
const mockGet = getUnreadCount as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockGet.mockReset();
  resetUnreadCount();
});

it('takes the count from the server', async () => {
  mockGet.mockResolvedValue({ count: 5 });
  await refreshUnreadCount();
  expect(getUnreadBadgeCount()).toBe(5);
});

it('keeps the last value, silently, when the fetch fails', async () => {
  mockGet.mockResolvedValueOnce({ count: 4 });
  await refreshUnreadCount();
  mockGet.mockRejectedValueOnce(new Error('offline'));
  await expect(refreshUnreadCount()).resolves.toBeUndefined();
  expect(getUnreadBadgeCount()).toBe(4);
});

it('adjusts immediately after a mark action, never below zero, then the server value wins', async () => {
  setUnreadBadgeCount(1);
  adjustUnreadBadgeCount(-1);
  expect(getUnreadBadgeCount()).toBe(0);
  adjustUnreadBadgeCount(-1);
  expect(getUnreadBadgeCount()).toBe(0);
  adjustUnreadBadgeCount(1);
  expect(getUnreadBadgeCount()).toBe(1);
  mockGet.mockResolvedValue({ count: 3 });
  await refreshUnreadCount();
  expect(getUnreadBadgeCount()).toBe(3);
});

it('is cleared on sign-out and a response still in flight for the old user is dropped', async () => {
  const late = deferred<{ count: number }>();
  mockGet.mockReturnValueOnce(late.promise);
  setUnreadBadgeCount(7);
  const pending = refreshUnreadCount();
  resetUnreadCount();
  expect(getUnreadBadgeCount()).toBe(0);
  late.resolve({ count: 7 });
  await pending;
  expect(getUnreadBadgeCount()).toBe(0);
});

it('a refresh requested while one is in flight triggers a follow-up read, not the stale answer', async () => {
  const first = deferred<{ count: number }>();
  mockGet.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ count: 2 });
  const a = refreshUnreadCount(); // started before the mark action
  const b = refreshUnreadCount(); // after the mark action
  first.resolve({ count: 3 }); // value read before the change
  await Promise.all([a, b]);
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(getUnreadBadgeCount()).toBe(2);
});

it('does not poll: no read happens until something asks for one', async () => {
  jest.useFakeTimers();
  mockGet.mockResolvedValue({ count: 1 });
  jest.advanceTimersByTime(10 * 60 * 1000);
  expect(mockGet).not.toHaveBeenCalled();
  jest.useRealTimers();
});
