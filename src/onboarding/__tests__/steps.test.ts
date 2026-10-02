/** Step order constant and flags. EXECUTES `getActiveSteps`. */
import { DEFAULT_STEP_CONTEXT, NOTIFICATION_STEP, ONBOARDING_STEP_ORDER, PHOTO_STEP, getActiveSteps } from '../steps';

const ALL_ON = { notificationStep: 'ENABLED', photoStep: 'ENABLED', hasMobileNumber: false, mobileAvailable: true } as const;

describe('step order constant', () => {
  it('is skills, notifications, mobile number, photo — in ONE constant', () => {
    expect(ONBOARDING_STEP_ORDER).toEqual(['skills', 'notifications', 'mobile', 'photo']);
  });

  it('ships with the architect defaults: notification step ENABLED, photo step OMIT', () => {
    expect(NOTIFICATION_STEP).toBe('ENABLED');
    expect(PHOTO_STEP).toBe('OMIT');
    expect(DEFAULT_STEP_CONTEXT).toEqual({ notificationStep: 'ENABLED', photoStep: 'OMIT' });
  });
});

describe('getActiveSteps', () => {
  it('follows the constant\'s order when everything is on', () => {
    expect(getActiveSteps(ALL_ON)).toEqual(['skills', 'notifications', 'mobile', 'photo']);
  });

  it('with the default flags the photo step is omitted', () => {
    expect(getActiveSteps({ ...DEFAULT_STEP_CONTEXT, hasMobileNumber: false, mobileAvailable: true })).toEqual([
      'skills',
      'notifications',
      'mobile',
    ]);
  });

  it('omits the notification step when flagged OMIT', () => {
    expect(getActiveSteps({ ...ALL_ON, notificationStep: 'OMIT', photoStep: 'OMIT' })).toEqual(['skills', 'mobile']);
  });

  it('omits the mobile step when a number is stored, or when the consent/country data is unavailable', () => {
    expect(getActiveSteps({ ...ALL_ON, photoStep: 'OMIT', hasMobileNumber: true })).toEqual(['skills', 'notifications']);
    expect(getActiveSteps({ ...ALL_ON, photoStep: 'OMIT', mobileAvailable: false })).toEqual(['skills', 'notifications']);
  });

  it('always keeps skills', () => {
    expect(
      getActiveSteps({ notificationStep: 'OMIT', photoStep: 'OMIT', hasMobileNumber: true, mobileAvailable: false }),
    ).toEqual(['skills']);
  });
});
