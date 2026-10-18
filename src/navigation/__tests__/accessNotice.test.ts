import {
  clearAccessNotice,
  closeUnavailableScreen,
  isAccessNoticeShowing,
  showAccessNotice,
  subscribeToAccessNotice,
} from '../accessNotice';

beforeEach(() => clearAccessNotice());

describe('access notice', () => {
  it('shows once: a second call while it is showing does not notify again', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToAccessNotice(listener);
    showAccessNotice();
    showAccessNotice();
    expect(isAccessNoticeShowing()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    clearAccessNotice();
    expect(isAccessNoticeShowing()).toBe(false);
    unsubscribe();
  });

  it('closeUnavailableScreen goes back and shows the notice', () => {
    const navigation = { goBack: jest.fn(), canGoBack: jest.fn(() => true) };
    closeUnavailableScreen(navigation);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(isAccessNoticeShowing()).toBe(true);
  });

  it('closeUnavailableScreen does not go back when it cannot, or without navigation', () => {
    const navigation = { goBack: jest.fn(), canGoBack: jest.fn(() => false) };
    closeUnavailableScreen(navigation);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(isAccessNoticeShowing()).toBe(true);
    clearAccessNotice();
    closeUnavailableScreen(undefined);
    expect(isAccessNoticeShowing()).toBe(true);
  });
});
