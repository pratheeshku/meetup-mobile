import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  applyTemplateDefaults,
  boardStepFor,
  buildCreateBody,
  buildOverrides,
  dateFailureIssue,
  firstDateFailure,
  firstInvalidStep,
  initialWizardState,
  listableTemplates,
  mapCreateRejection,
  validateBasics,
  validateCommittee,
  validateParticipation,
  validateRegistration,
  validateStep,
  validateWindow,
  visibilityOf,
  withClosure,
  withHardBlock,
  type WizardContext,
  type WizardState,
} from '../tournamentWizard';
import { GROUP_TEMPLATE, KNOCKOUT_TEMPLATE, TEMPLATES } from '../../test-utils/tournamentWizardFixtures';

const NOW = new Date(2026, 9, 14, 9, 0); // 14 Oct 2026 09:00 local
const day = (date: Date): string => `d${date.getDate()}`;
const ctx: WizardContext = { templates: listableTemplates(TEMPLATES), limits: FALLBACK_LIMITS, catalogueEnabled: false, now: NOW, formatDay: day };

/** "YYYY-MM-DD HH:mm" as the shared date-time field emits it. */
const at = (month: number, dayOfMonth: number, hour = 9, minute = 0): string =>
  `2026-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
const dt = (month: number, dayOfMonth: number, hour = 9, minute = 0): Date => new Date(2026, month - 1, dayOfMonth, hour, minute);

function validState(over: Partial<WizardState> = {}): WizardState {
  return {
    ...applyTemplateDefaults(initialWizardState('req-1', 'badminton'), GROUP_TEMPLATE),
    title: 'Punggol Open 2026',
    startsAt: at(11, 14, 9),
    endsAt: at(11, 15, 18),
    closesAt: at(10, 30, 9),
    hardBlockAt: at(11, 3, 9),
    hardBlockTouched: true,
    venueName: 'Punggol Sports Hall',
    committee: [{ id: 'u-ravi', displayName: 'Ravi K.' }],
    ...over,
  };
}

describe('templates', () => {
  it('lists only groups and knockout templates', () => {
    expect(listableTemplates(TEMPLATES).map(t => t.id)).toEqual([GROUP_TEMPLATE.id]);
    expect(listableTemplates({ templates: [KNOCKOUT_TEMPLATE] })).toEqual([]);
    expect(listableTemplates({ templates: [] })).toEqual([]);
    expect(listableTemplates(null)).toEqual([]);
  });

  it('choosing a template starts the counts at the template values', () => {
    const state = applyTemplateDefaults(initialWizardState('r'), GROUP_TEMPLATE);
    expect([state.entrantsMin, state.entrantsMax, state.teamSizeMin, state.teamSizeMax]).toEqual([8, 32, 2, 4]);
  });

  it('sends only the overrides the template lists and the organizer changed', () => {
    const state = validState({ entrantsMin: 6, entrantsMax: 32 });
    expect(buildOverrides(state, GROUP_TEMPLATE)).toEqual({ entrants_min: 6 });
    const noOverrides = { ...GROUP_TEMPLATE, format: { ...GROUP_TEMPLATE.format, organizer_overrides: [] } };
    expect(buildOverrides(state, noOverrides)).toEqual({});
  });
});

describe('step validation', () => {
  it('basics: sport and name required, name length capped', () => {
    expect(validateBasics({ ...validState(), title: '   ' }).map(i => i.key)).toEqual(['mob.tw.err_title']);
    expect(validateBasics({ ...validState(), sport: '' }).map(i => i.key)).toEqual(['mob.tw.err_sport']);
    expect(validateBasics({ ...validState(), title: 'x'.repeat(151) }).map(i => i.key)).toEqual(['mob.tw.err_title_long']);
    expect(validateBasics(validState())).toEqual([]);
  });

  it('participation: maximum below minimum, and values outside the template limits', () => {
    expect(validateParticipation(validState({ entrantsMin: 12, entrantsMax: 8 }), GROUP_TEMPLATE).map(i => i.key)).toContain('mob.tw.err_players_order');
    expect(
      validateParticipation(validState({ participation: 'team', teamSizeMin: 2, teamSizeMax: 1 }), GROUP_TEMPLATE).map(i => i.key),
    ).toContain('mob.tw.err_team_size_order');
    expect(validateParticipation(validState({ entrantsMin: 2 }), GROUP_TEMPLATE).map(i => i.key)).toContain('mob.tw.err_count_range');
    expect(validateParticipation(validState(), GROUP_TEMPLATE)).toEqual([]);
  });

  it('committee: at least one besides the organizer, at most committee_max - 1', () => {
    expect(validateCommittee(validState({ committee: [] }), 10).map(i => i.key)).toEqual(['mob.tw.err_committee_few']);
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `u${i}`, displayName: `P${i}` }));
    expect(validateCommittee(validState({ committee: nine }), 10)).toEqual([]);
    expect(validateCommittee(validState({ committee: [...nine, { id: 'x', displayName: 'X' }] }), 10).map(i => i.key)).toEqual([
      'mob.tw.err_committee_many',
    ]);
  });
});

describe('the five date rules (AD-20 step 3), in the server order', () => {
  const ok = { startsAt: dt(11, 14, 9), endsAt: dt(11, 15, 18), closesAt: dt(10, 30, 9), hardBlockAt: dt(11, 3, 9) };

  it('passes a consistent set', () => {
    expect(firstDateFailure(ok, NOW, 72)).toBeNull();
  });

  it('1: closure, hard block, start and end must all be in the future', () => {
    expect(firstDateFailure({ ...ok, closesAt: dt(10, 14, 8) }, NOW, 72)).toEqual({ field: 'registration_closes_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(10, 14, 9) }, NOW, 72)).toEqual({ field: 'registration_hard_block_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, startsAt: dt(10, 13, 9) }, NOW, 72)).toEqual({ field: 'starts_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, endsAt: dt(10, 13, 18) }, NOW, 72)).toEqual({ field: 'ends_at', reason: 'DATE_IN_PAST' });
  });

  it('2: end after start', () => {
    expect(firstDateFailure({ ...ok, endsAt: dt(11, 14, 9) }, NOW, 72)).toEqual({ field: 'ends_at', reason: 'END_BEFORE_START' });
  });

  it('3: daily start time before daily end time (no overnight window)', () => {
    expect(firstDateFailure({ ...ok, startsAt: dt(11, 14, 19), endsAt: dt(11, 15, 8) }, NOW, 72)).toEqual({
      field: 'ends_at',
      reason: 'DAILY_WINDOW_INVALID',
    });
  });

  it('4: closure not after the hard block', () => {
    expect(firstDateFailure({ ...ok, closesAt: dt(11, 4, 9), hardBlockAt: dt(11, 3, 9) }, NOW, 72)).toEqual({
      field: 'registration_closes_at',
      reason: 'REG_CLOSE_AFTER_HARD',
    });
    // closure equal to the hard block is allowed
    expect(firstDateFailure({ ...ok, closesAt: dt(11, 3, 9) }, NOW, 72)).toBeNull();
  });

  it('5: hard block + gap <= start', () => {
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 12, 9) }, NOW, 72)).toEqual({
      field: 'registration_hard_block_at',
      reason: 'HARD_BLOCK_TOO_CLOSE',
    });
  });

  it('when two rules fail the lower-numbered one is returned', () => {
    expect(firstDateFailure({ ...ok, startsAt: dt(10, 13, 9), endsAt: dt(10, 13, 8), closesAt: dt(11, 4, 9) }, NOW, 72)?.reason).toBe('DATE_IN_PAST');
  });

  it('the exact boundary passes (hard block exactly gap hours before the start)', () => {
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 11, 8, 59) }, NOW, 72)).toBeNull();
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 11, 9, 0) }, NOW, 72)).toBeNull();
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 11, 9, 1) }, NOW, 72)?.reason).toBe('HARD_BLOCK_TOO_CLOSE');
  });

  it('messages: gap wording, "before the tournament starts" when at or after the start, window wording', () => {
    const gap = dateFailureIssue({ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, { minGapHours: 72, startLabel: 'Sat 14 Nov', hardBlockAtOrAfterStart: false });
    expect(gap).toMatchObject({ key: 'mob.tw.err_hard_gap_days', params: { gap: 3, start: 'Sat 14 Nov' }, step: WIZARD_STEP.registration });
    const hours = dateFailureIssue({ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, { minGapHours: 36, startLabel: 'x', hardBlockAtOrAfterStart: false });
    expect(hours.key).toBe('mob.tw.err_hard_gap_hours');
    const after = dateFailureIssue({ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, { minGapHours: 72, startLabel: 'x', hardBlockAtOrAfterStart: true });
    expect(after.key).toBe('mob.tw.err_hard_after_start');
    expect(dateFailureIssue({ field: 'ends_at', reason: 'END_BEFORE_START' }, { minGapHours: 72, startLabel: '', hardBlockAtOrAfterStart: false })).toMatchObject({
      key: 'mob.tw.err_window',
      step: WIZARD_STEP.when,
    });
    expect(
      dateFailureIssue({ field: 'registration_closes_at', reason: 'REG_CLOSE_AFTER_HARD' }, { minGapHours: 72, startLabel: '', hardBlockAtOrAfterStart: false }).key,
    ).toBe('mob.tw.err_soft_after_hard');
  });

  it('step 4 reports the window, step 5 only the registration rules', () => {
    expect(validateWindow(validState({ startsAt: '', endsAt: '' }), NOW).map(i => i.field)).toEqual(['starts_at', 'ends_at']);
    expect(validateWindow(validState({ endsAt: at(11, 14, 9) }), NOW).map(i => i.key)).toEqual(['mob.tw.err_window']);
    expect(validateRegistration(validState({ closesAt: at(11, 4, 9) }), NOW, 72, day).map(i => i.key)).toEqual(['mob.tw.err_soft_after_hard']);
    expect(validateRegistration(validState({ hardBlockAt: at(11, 16, 9) }), NOW, 72, day).map(i => i.key)).toEqual(['mob.tw.err_hard_after_start']);
    expect(validateRegistration(validState({ hardBlockAt: at(11, 12, 9) }), NOW, 72, day).map(i => i.key)).toEqual(['mob.tw.err_hard_gap_days']);
    expect(validateRegistration(validState({ closesAt: '' }), NOW, 72, day).map(i => i.key)).toEqual(['mob.tw.err_required']);
    // a window failure is not repeated on the registration step
    expect(validateRegistration(validState({ endsAt: at(11, 14, 9) }), NOW, 72, day)).toEqual([]);
  });

  it('the hard block follows the closure until the organizer sets it', () => {
    let state = initialWizardState('r');
    state = withClosure(state, at(10, 30, 9));
    expect(state.hardBlockAt).toBe(at(10, 30, 9));
    state = withHardBlock(state, at(11, 3, 9));
    state = withClosure(state, at(10, 25, 9));
    expect(state.hardBlockAt).toBe(at(11, 3, 9));
  });
});

describe('visibility mapping', () => {
  it('public is public; private with groups is group; private with none is invite', () => {
    expect(visibilityOf(validState())).toBe('public');
    expect(visibilityOf(validState({ isPrivate: true, groupIds: ['g1'] }))).toBe('group');
    expect(visibilityOf(validState({ isPrivate: true, groupIds: [] }))).toBe('invite');
  });
});

describe('request body', () => {
  it('has exactly the contract fields, ISO instants, and the one client_request_id', () => {
    const body = buildCreateBody(validState(), GROUP_TEMPLATE, false);
    expect(Object.keys(body).sort()).toEqual(
      [
        'client_request_id', 'template_id', 'overrides', 'title', 'sport', 'participation_mode', 'visibility', 'venue_name',
        'starts_at', 'ends_at', 'registration_closes_at', 'registration_hard_block_at', 'committee_member_ids',
      ].sort(),
    );
    expect(body.client_request_id).toBe('req-1');
    expect(body.starts_at).toBe(dt(11, 14, 9).toISOString());
    expect(body.committee_member_ids).toEqual(['u-ravi']);
    expect(body).not.toHaveProperty('group_ids');
    expect(body).not.toHaveProperty('description');
  });

  it('group visibility carries group_ids; a description is trimmed and sent when present', () => {
    const body = buildCreateBody(validState({ isPrivate: true, groupIds: ['g1', 'g2'], description: '  Bring shuttles  ' }), GROUP_TEMPLATE, false);
    expect(body.visibility).toBe('group');
    expect(body.group_ids).toEqual(['g1', 'g2']);
    expect(body.description).toBe('Bring shuttles');
  });

  it('venue: catalogue id, Others form, or the text fields when the catalogue is off', () => {
    const catalogue = buildCreateBody(validState({ venue: { venueId: 'v-1', name: 'Hall', address: 'x' } }), GROUP_TEMPLATE, true);
    expect(catalogue.venue_id).toBe('v-1');
    expect(catalogue).not.toHaveProperty('venue_name');
    const others = buildCreateBody(
      validState({ venue: { venueId: null, othersInput: { name: 'Court', postal_code: '123456' }, name: 'Court', address: '' } }),
      GROUP_TEMPLATE,
      true,
    );
    expect(others.others).toEqual({ name: 'Court', postal_code: '123456' });
    expect(others).not.toHaveProperty('venue_id');
    const text = buildCreateBody(validState({ venueName: ' Hall ', venueAddress: ' 1 Road ' }), GROUP_TEMPLATE, false);
    expect([text.venue_name, text.venue_address]).toEqual(['Hall', '1 Road']);
  });
});

describe('whole-wizard validity', () => {
  it('a complete state has no invalid step; an empty one starts at step 1', () => {
    expect(firstInvalidStep(validState(), ctx)).toBeNull();
    expect(firstInvalidStep(initialWizardState('r', 'badminton'), ctx)).toBe(WIZARD_STEP.basics);
    expect(firstInvalidStep(validState({ committee: [] }), ctx)).toBe(WIZARD_STEP.committee);
    expect(validateStep(WIZARD_STEP.visibility, validState(), ctx)).toEqual([]);
  });
});

describe('server rejections map to the step and field the boards show', () => {
  const rctx = { minGapHours: 72, committeeMax: 10, startLabel: 'Sat 14 Nov', hardBlockAtOrAfterStart: false };
  const reject = (status: number, data: unknown) => ({ response: { status, data } });

  it('TOURNAMENT_DATES_INVALID by field and reason', () => {
    const cases: [Record<string, string>, number, string, string][] = [
      [{ field: 'starts_at', reason: 'DATE_IN_PAST' }, WIZARD_STEP.when, 'starts_at', 'mob.tw.err_window'],
      [{ field: 'ends_at', reason: 'END_BEFORE_START' }, WIZARD_STEP.when, 'ends_at', 'mob.tw.err_window'],
      [{ field: 'ends_at', reason: 'DAILY_WINDOW_INVALID' }, WIZARD_STEP.when, 'ends_at', 'mob.tw.err_daily_window'],
      [{ field: 'registration_closes_at', reason: 'REG_CLOSE_AFTER_HARD' }, WIZARD_STEP.registration, 'registration_closes_at', 'mob.tw.err_soft_after_hard'],
      [{ field: 'registration_closes_at', reason: 'DATE_IN_PAST' }, WIZARD_STEP.registration, 'registration_closes_at', 'mob.tw.err_reg_past'],
      [{ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, WIZARD_STEP.registration, 'registration_hard_block_at', 'mob.tw.err_hard_gap_days'],
    ];
    cases.forEach(([body, step, field, key]) => {
      const outcome = mapCreateRejection(reject(422, { code: 'TOURNAMENT_DATES_INVALID', step: 3, ...body }), rctx);
      expect(outcome).toMatchObject({ kind: 'step', step, issue: { field, key } });
    });
  });

  it('group and committee rejections go to their steps and name what to drop', () => {
    expect(mapCreateRejection(reject(422, { code: 'GROUP_CAP_EXCEEDED', step: 4 }), rctx)).toMatchObject({ kind: 'step', step: WIZARD_STEP.visibility });
    expect(mapCreateRejection(reject(403, { code: 'GROUP_NOT_MEMBER', group_id: 'g9', step: 4 }), rctx)).toMatchObject({
      kind: 'step',
      step: WIZARD_STEP.visibility,
      dropGroupId: 'g9',
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'TOO_FEW', step: 6 }), rctx)).toMatchObject({
      step: WIZARD_STEP.committee,
      issue: { key: 'mob.tw.err_committee_few' },
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'TOO_MANY', step: 6 }), rctx)).toMatchObject({
      issue: { key: 'mob.tw.err_committee_many', params: { max: 10 } },
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'USER_UNAVAILABLE', user_id: 'u9', step: 6 }), rctx)).toMatchObject({
      dropUserId: 'u9',
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'DUPLICATE', user_id: 'u9', step: 6 }), rctx)).toMatchObject({
      issue: { key: 'mob.tw.err_committee_duplicate' },
    });
  });

  it('a retired or missing template returns to the format step', () => {
    expect(mapCreateRejection(reject(409, { code: 'TEMPLATE_NOT_ACTIVE', step: 5 }), rctx)).toMatchObject({ kind: 'format_retired', step: WIZARD_STEP.format });
    expect(mapCreateRejection(reject(404, { code: 'TEMPLATE_NOT_FOUND', step: 5 }), rctx)).toMatchObject({ kind: 'format_retired' });
    expect(mapCreateRejection(reject(422, { code: 'OVERRIDES_INVALID', step: 5 }), rctx)).toMatchObject({ step: WIZARD_STEP.participation });
    expect(mapCreateRejection(reject(422, { code: 'VENUE_INVALID', step: 1 }), rctx)).toMatchObject({ step: WIZARD_STEP.when });
  });

  it('v2 disabled, network drops and unknown bodies stay on review', () => {
    expect(mapCreateRejection(reject(409, { detail: 'v2 tournament creation is disabled' }), rctx).kind).toBe('disabled');
    expect(mapCreateRejection(new Error('Network Error'), rctx)).toMatchObject({ kind: 'failed', issue: { key: 'mob.tw.err_create_failed' } });
    expect(mapCreateRejection(reject(500, undefined), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(422, { detail: [{ loc: ['body'], msg: 'x' }] }), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(503, { code: 'TOURNAMENT_CONFIG_INVALID' }), rctx).kind).toBe('failed');
  });

  it('server step numbers translate to board steps', () => {
    expect([1, 2, 4, 5, 6].map(step => boardStepFor(step, undefined))).toEqual([4, 3, 6, 2, 7]);
    expect(boardStepFor(3, 'ends_at')).toBe(WIZARD_STEP.when);
    expect(boardStepFor(3, 'registration_hard_block_at')).toBe(WIZARD_STEP.registration);
    expect(boardStepFor(undefined, undefined)).toBeNull();
  });
});
