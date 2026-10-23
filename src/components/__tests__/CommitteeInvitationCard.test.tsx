/** Committee invitation card: content and order, each answer state's inline label, Retry for `failed` only, no id. */
import React from 'react';

import { getSports } from '../../api/sports';
import type { LabelKey } from '../../labels/fallbackLabels';
import { pressables, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { CommitteeInvitationSummary } from '../../types/tournament';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { CommitteeAnswerState } from '../../utils/committeeInvitation';
import CommitteeInvitationCard from '../tournament/CommitteeInvitationCard';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const SUMMARY: CommitteeInvitationSummary = {
  tournament_id: 'tid-9f3c-hidden',
  status: 'upcoming',
  title: 'Punggol Open 2026',
  sport: 'badminton',
  starts_at: new Date(2026, 10, 14, 10).toISOString(),
  ends_at: new Date(2026, 10, 15, 10).toISOString(),
  organizer_name: 'Ravi K.',
};

type CardProps = React.ComponentProps<typeof CommitteeInvitationCard>;
const baseProps = (over: Partial<CardProps> = {}): CardProps => ({
  summary: SUMMARY,
  state: null,
  messageKey: null,
  busy: null,
  onAccept: jest.fn(),
  onDecline: jest.fn(),
  onRetry: jest.fn(),
  ...over,
});
const press = (root: Instance, testID: string): Instance | undefined =>
  pressables(root).find(node => node.props.testID === testID);

beforeEach(() => {
  (getSports as jest.Mock).mockReset().mockRejectedValue(new Error('down'));
  __resetSportDisplayNamesCacheForTests();
});

describe('CommitteeInvitationCard', () => {
  it('shows the web card content in the web order, re-flowed to one column', async () => {
    const root = await renderAsync(<CommitteeInvitationCard {...baseProps()} />);
    const all = texts(root);
    const order = [
      'Ravi K. invited you to the committee',
      'Punggol Open 2026 needs at least two committee members. As a committee member you can enter scores, review fixtures, and approve big decisions such as publishing fixtures. You are accountable for what you approve.',
      'Punggol Open 2026',
      'Sport',
      'badminton',
      'Dates',
      'Organizer',
      'Ravi K.',
      'Accept and join committee',
      'Decline',
    ].map(text => all.indexOf(text));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(all.some(text => /14 – 15/.test(text))).toBe(true);
    expect(press(root, 'committee-invitation-retry')).toBeUndefined();
  });

  it('names people by name and never renders an id', async () => {
    const root = await renderAsync(<CommitteeInvitationCard {...baseProps()} />);
    expect(texts(root).join(' ')).not.toContain('tid-9f3c-hidden');
    const noName = await renderAsync(
      <CommitteeInvitationCard {...baseProps({ summary: { ...SUMMARY, organizer_name: '' } })} />,
    );
    expect(texts(noName)).toContain('You are invited to the committee');
    expect(texts(noName).join(' ')).not.toContain('tid-9f3c-hidden');
    expect(noName.findAllByProps({ testID: 'committee-invitation-row-organizer' })).toHaveLength(0);
  });

  it('Accept and Decline call their handlers; touch targets are at least 44pt', async () => {
    const props = baseProps();
    const root = await renderAsync(<CommitteeInvitationCard {...props} />);
    press(root, 'committee-invitation-accept')!.props.onPress();
    press(root, 'committee-invitation-decline')!.props.onPress();
    expect(props.onAccept).toHaveBeenCalledTimes(1);
    expect(props.onDecline).toHaveBeenCalledTimes(1);
    for (const id of ['committee-invitation-accept', 'committee-invitation-decline']) {
      const style = JSON.stringify(press(root, id)!.props.style({ pressed: false }));
      expect(Number(/"minHeight":(\d+)/.exec(style)?.[1])).toBeGreaterThanOrEqual(44);
    }
  });

  it.each(['accept', 'decline'] as const)('while %s is in flight both buttons are disabled and one is busy', async busy => {
    const root = await renderAsync(<CommitteeInvitationCard {...baseProps({ busy })} />);
    for (const id of ['committee-invitation-accept', 'committee-invitation-decline']) {
      expect(press(root, id)!.props.disabled).toBe(true);
    }
    const busyId = `committee-invitation-${busy}`;
    expect(press(root, busyId)!.props.accessibilityState).toMatchObject({ busy: true });
    const otherId = `committee-invitation-${busy === 'accept' ? 'decline' : 'accept'}`;
    expect(press(root, otherId)!.props.accessibilityState).toMatchObject({ busy: false });
  });

  const REFUSALS: [CommitteeAnswerState, LabelKey, string][] = [
    ['already_active', 'mob.committee_invite.already_active', 'You are already on this committee.'],
    ['closed', 'mob.committee_invite.closed', 'This committee invitation is no longer open.'],
    ['not_invited', 'mob.committee_invite.not_invited', 'You have no committee invitation for this tournament.'],
    ['cancelled', 'mob.committee_invite.cancelled', 'This tournament was cancelled.'],
    ['ended', 'mob.committee_invite.ended', 'This tournament has ended, so the committee can no longer change.'],
    [
      'disabled',
      'mob.committee_invite.disabled',
      'Committee invitations are not available right now. Please try again later.',
    ],
  ];
  it.each(REFUSALS)('%s: its label shows inline, no buttons, no Retry, no crash', async (state, messageKey, text) => {
    const root = await renderAsync(<CommitteeInvitationCard {...baseProps({ state, messageKey })} />);
    expect(texts(root)).toContain(text);
    expect(pressables(root)).toHaveLength(0);
  });

  it('failed: the label, Retry (the only state with one), and the buttons stay for another try', async () => {
    const props = baseProps({ state: 'failed', messageKey: 'mob.committee_invite.failed' });
    const root = await renderAsync(<CommitteeInvitationCard {...props} />);
    expect(texts(root)).toContain('Could not send your answer. Please try again.');
    press(root, 'committee-invitation-retry')!.props.onPress();
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    expect(press(root, 'committee-invitation-accept')).toBeDefined();
    expect(press(root, 'committee-invitation-decline')).toBeDefined();
  });

  it('without a summary only the state label shows (a failed read still offers Retry)', async () => {
    const closed = await renderAsync(
      <CommitteeInvitationCard
        {...baseProps({ summary: null, state: 'not_invited', messageKey: 'mob.committee_invite.not_invited' })}
      />,
    );
    expect(texts(closed)).toEqual(['You have no committee invitation for this tournament.']);
    const failed = await renderAsync(
      <CommitteeInvitationCard
        {...baseProps({ summary: null, state: 'failed', messageKey: 'mob.committee_invite.failed' })}
      />,
    );
    expect(press(failed, 'committee-invitation-retry')).toBeDefined();
    expect(press(failed, 'committee-invitation-accept')).toBeUndefined();
  });
});
