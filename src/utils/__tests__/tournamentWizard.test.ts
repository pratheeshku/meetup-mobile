import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  WIZARD_TOTAL_STEPS,
  boardStepFor,
  buildCreateBody,
  dateFailureIssue,
  displayStep,
  firstDateFailure,
  firstFocusField,
  firstInvalidStep,
  initialWizardState,
  listableTemplates,
  mapCreateRejection,
  registrationRules,
  validateBasics,
  validateCommittee,
  validateRegistration,
  validateStep,
  validateVenue,
  VENUE_DETAIL_MAX,
  validateWindow,
  visibilityOf,
  withClosure,
  withHardBlock,
  type WizardContext,
  type WizardState,
} from '../tournamentWizard';
import { KNOCKOUT_TEMPLATE, GROUP_TEMPLATE, TEMPLATES } from '../../test-utils/tournamentWizardFixtures';

const NOW = new Date(2026, 9, 14, 9, 0); // 14 Oct 2026 09:00 local
const dayTime = (date: Date): string => `d${date.getDate()}`;
const ctx: WizardContext = { limits: FALLBACK_LIMITS, catalogueEnabled: false, now: NOW, formatDayTime: dayTime };

/** "YYYY-MM-DD HH:mm" as the shared date-time field emits it. */
const at = (month: number, dayOfMonth: number, hour = 9, minute = 0): string =>
  `2026-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
const dt = (month: number, dayOfMonth: number, hour = 9, minute = 0): Date => new Date(2026, month - 1, dayOfMonth, hour, minute);

function validState(over: Partial<WizardState> = {}): WizardState {
  return {
    ...initialWizardState('req-1', 'badminton'),
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
  it('lists only groups and knockout templates (the entry check of the wizard)', () => {
    expect(listableTemplates(TEMPLATES).map(t => t.id)).toEqual([GROUP_TEMPLATE.id]);
    expect(listableTemplates({ templates: [KNOCKOUT_TEMPLATE] })).toEqual([]);
    expect(listableTemplates({ templates: [] })).toEqual([]);
    expect(listableTemplates(null)).toEqual([]);
  });
});

describe('six steps (AD-T3)', () => {
  it('the header counts the server steps: Dates covers both date screens, Review is the sixth', () => {
    expect(WIZARD_TOTAL_STEPS).toBe(6);
    expect(
      [WIZARD_STEP.basics, WIZARD_STEP.participation, WIZARD_STEP.when, WIZARD_STEP.registration, WIZARD_STEP.visibility, WIZARD_STEP.committee, WIZARD_STEP.review].map(
        displayStep,
      ),
    ).toEqual([1, 2, 3, 3, 4, 5, 6]);
  });
});

describe('step validation', () => {
  it('basics: sport and name required, name length capped', () => {
    expect(validateBasics({ ...validState(), title: '   ' }).map(i => i.key)).toEqual(['mob.tw.err_title']);
    expect(validateBasics({ ...validState(), sport: '' }).map(i => i.key)).toEqual(['mob.tw.err_sport']);
    expect(validateBasics({ ...validState(), title: 'x'.repeat(151) }).map(i => i.key)).toEqual(['mob.tw.err_title_long']);
    expect(validateBasics(validState())).toEqual([]);
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

describe('the five date rules (AD-T4), in the server order', () => {
  const ok = { startsAt: dt(11, 14, 9), endsAt: dt(11, 15, 18), closesAt: dt(10, 30, 9), hardBlockAt: dt(11, 3, 9) };

  it('passes a consistent set', () => {
    expect(firstDateFailure(ok, NOW)).toBeNull();
  });

  it('1: closure, hard block, start and end must all be in the future', () => {
    expect(firstDateFailure({ ...ok, closesAt: dt(10, 14, 8) }, NOW)).toEqual({ field: 'registration_closes_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(10, 14, 9) }, NOW)).toEqual({ field: 'registration_hard_block_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, startsAt: dt(10, 13, 9) }, NOW)).toEqual({ field: 'starts_at', reason: 'DATE_IN_PAST' });
    expect(firstDateFailure({ ...ok, endsAt: dt(10, 13, 18) }, NOW)).toEqual({ field: 'ends_at', reason: 'DATE_IN_PAST' });
  });

  it('2: end after start', () => {
    expect(firstDateFailure({ ...ok, endsAt: dt(11, 14, 9) }, NOW)).toEqual({ field: 'ends_at', reason: 'END_BEFORE_START' });
  });

  it('3: daily start time before daily end time (no overnight window)', () => {
    expect(firstDateFailure({ ...ok, startsAt: dt(11, 14, 19), endsAt: dt(11, 15, 8) }, NOW)).toEqual({
      field: 'ends_at',
      reason: 'DAILY_WINDOW_INVALID',
    });
  });

  it('4: closure not after the hard block', () => {
    expect(firstDateFailure({ ...ok, closesAt: dt(11, 4, 9), hardBlockAt: dt(11, 3, 9) }, NOW)).toEqual({
      field: 'registration_closes_at',
      reason: 'REG_CLOSE_AFTER_HARD',
    });
    // closure equal to the hard block is allowed
    expect(firstDateFailure({ ...ok, closesAt: dt(11, 3, 9) }, NOW)).toBeNull();
  });

  it('5: hard block not after the start (no minimum gap)', () => {
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 14, 9, 1) }, NOW)).toEqual({
      field: 'registration_hard_block_at',
      reason: 'HARD_BLOCK_TOO_CLOSE',
    });
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 16, 9) }, NOW)?.reason).toBe('HARD_BLOCK_TOO_CLOSE');
  });

  it('when two rules fail the lower-numbered one is returned', () => {
    expect(firstDateFailure({ ...ok, startsAt: dt(10, 13, 9), endsAt: dt(10, 13, 8), closesAt: dt(11, 4, 9) }, NOW)?.reason).toBe('DATE_IN_PAST');
  });

  it('the exact boundary passes: a hard block at the first game, and no gap is enforced', () => {
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 14, 9, 0) }, NOW)).toBeNull();
    expect(firstDateFailure({ ...ok, hardBlockAt: dt(11, 14, 8, 59) }, NOW)).toBeNull();
    expect(firstDateFailure({ ...ok, closesAt: dt(10, 14, 9, 1), hardBlockAt: dt(10, 14, 9, 2) }, NOW)).toBeNull();
  });

  it('messages: board wording per rule, with the first game named', () => {
    const after = dateFailureIssue({ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, { startLabel: 'Sat 14 Nov, 9:00 AM' });
    expect(after).toMatchObject({ key: 'mob.tw.dates_err_hard_after_start', params: { when: 'Sat 14 Nov, 9:00 AM' }, step: WIZARD_STEP.registration });
    expect(dateFailureIssue({ field: 'registration_closes_at', reason: 'DATE_IN_PAST' }, { startLabel: '' }).key).toBe('mob.tw.dates_err_past');
    expect(dateFailureIssue({ field: 'ends_at', reason: 'END_BEFORE_START' }, { startLabel: '' })).toMatchObject({
      key: 'mob.tw.err_window',
      step: WIZARD_STEP.when,
    });
    expect(dateFailureIssue({ field: 'registration_closes_at', reason: 'REG_CLOSE_AFTER_HARD' }, { startLabel: '' }).key).toBe('mob.tw.dates_err_soft_after_hard');
  });

  it('the rule checklist of the board: met, broken or not decidable yet', () => {
    expect(registrationRules(validState(), NOW)).toEqual({ future: 'ok', order: 'ok', start: 'ok' });
    expect(registrationRules(validState({ closesAt: at(10, 13, 9) }), NOW)).toEqual({ future: 'bad', order: 'ok', start: 'ok' });
    expect(registrationRules(validState({ hardBlockAt: at(11, 16, 9) }), NOW)).toEqual({ future: 'ok', order: 'ok', start: 'bad' });
    expect(registrationRules(validState({ closesAt: at(11, 4, 9) }), NOW).order).toBe('bad');
    expect(registrationRules(initialWizardState('r'), NOW)).toEqual({ future: 'unknown', order: 'unknown', start: 'unknown' });
  });

  it('the window screen reports the window, the registration screen only the registration rules', () => {
    expect(validateWindow(validState({ startsAt: '', endsAt: '' }), NOW).map(i => i.field)).toEqual(['starts_at', 'ends_at']);
    expect(validateWindow(validState({ endsAt: at(11, 14, 9) }), NOW).map(i => i.key)).toEqual(['mob.tw.err_window']);
    expect(validateRegistration(validState({ closesAt: at(11, 4, 9) }), NOW, dayTime).map(i => i.key)).toEqual(['mob.tw.dates_err_soft_after_hard']);
    expect(validateRegistration(validState({ hardBlockAt: at(11, 16, 9) }), NOW, dayTime).map(i => i.key)).toEqual(['mob.tw.dates_err_hard_after_start']);
    // a hard block exactly at the first game is fine; so is one a day before (no gap)
    expect(validateRegistration(validState({ hardBlockAt: at(11, 14, 9) }), NOW, dayTime)).toEqual([]);
    expect(validateRegistration(validState({ hardBlockAt: at(11, 13, 9) }), NOW, dayTime)).toEqual([]);
    expect(validateRegistration(validState({ closesAt: '' }), NOW, dayTime).map(i => i.key)).toEqual(['mob.tw.err_required']);
    // a window failure is not repeated on the registration step
    expect(validateRegistration(validState({ endsAt: at(11, 14, 9) }), NOW, dayTime)).toEqual([]);
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
    const body = buildCreateBody(validState(), false);
    // AD-T3: neither template_id nor overrides is ever sent.
    expect(body).not.toHaveProperty('template_id');
    expect(body).not.toHaveProperty('overrides');
    expect(Object.keys(body).sort()).toEqual(
      [
        'client_request_id', 'title', 'sport', 'participation_mode', 'visibility', 'venue_name',
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
    const body = buildCreateBody(validState({ isPrivate: true, groupIds: ['g1', 'g2'], description: '  Bring shuttles  ' }), false);
    expect(body.visibility).toBe('group');
    expect(body.group_ids).toEqual(['g1', 'g2']);
    expect(body.description).toBe('Bring shuttles');
  });

  it('venue: catalogue id, Others form, or the text fields when the catalogue is off', () => {
    const catalogue = buildCreateBody(validState({ venue: { venueId: 'v-1', name: 'Hall', address: 'x' } }), true);
    expect(catalogue.venue_id).toBe('v-1');
    expect(catalogue).not.toHaveProperty('venue_name');
    const others = buildCreateBody(
      validState({ venue: { venueId: null, othersInput: { name: 'Court', postal_code: '123456' }, name: 'Court', address: '' } }),
      true,
    );
    expect(others.others).toEqual({ name: 'Court', postal_code: '123456' });
    expect(others).not.toHaveProperty('venue_id');
    const text = buildCreateBody(validState({ venueName: ' Hall ', venueAddress: ' 1 Road ' }), false);
    expect([text.venue_name, text.venue_address]).toEqual(['Hall', '1 Road']);
  });
});

describe('whole-wizard validity', () => {
  it('a complete state has no invalid step; an empty one starts at step 1', () => {
    expect(firstInvalidStep(validState(), ctx)).toBeNull();
    expect(firstInvalidStep(initialWizardState('r', 'badminton'), ctx)).toBe(WIZARD_STEP.basics);
    expect(firstInvalidStep(validState({ committee: [] }), ctx)).toBe(WIZARD_STEP.committee);
    expect(firstInvalidStep(validState({ hardBlockAt: at(11, 16, 9) }), ctx)).toBe(WIZARD_STEP.registration);
    expect(validateStep(WIZARD_STEP.visibility, validState(), ctx)).toEqual([]);
  });
});

describe('server rejections map to the step and field the boards show', () => {
  const rctx = { committeeMax: 10, startLabel: 'Sat 14 Nov, 9:00 AM' };
  const reject = (status: number, data: unknown) => ({ response: { status, data } });

  it('TOURNAMENT_DATES_INVALID by field and reason', () => {
    const cases: [Record<string, string>, number, string, string][] = [
      [{ field: 'starts_at', reason: 'DATE_IN_PAST' }, WIZARD_STEP.when, 'starts_at', 'mob.tw.err_window'],
      [{ field: 'ends_at', reason: 'END_BEFORE_START' }, WIZARD_STEP.when, 'ends_at', 'mob.tw.err_window'],
      [{ field: 'ends_at', reason: 'DAILY_WINDOW_INVALID' }, WIZARD_STEP.when, 'ends_at', 'mob.tw.err_daily_window'],
      [{ field: 'registration_closes_at', reason: 'REG_CLOSE_AFTER_HARD' }, WIZARD_STEP.registration, 'registration_closes_at', 'mob.tw.dates_err_soft_after_hard'],
      [{ field: 'registration_closes_at', reason: 'DATE_IN_PAST' }, WIZARD_STEP.registration, 'registration_closes_at', 'mob.tw.dates_err_past'],
      [{ field: 'registration_hard_block_at', reason: 'HARD_BLOCK_TOO_CLOSE' }, WIZARD_STEP.registration, 'registration_hard_block_at', 'mob.tw.dates_err_hard_after_start'],
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
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'TOO_FEW', step: 5 }), rctx)).toMatchObject({
      step: WIZARD_STEP.committee,
      issue: { key: 'mob.tw.err_committee_few' },
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'TOO_MANY', step: 5 }), rctx)).toMatchObject({
      issue: { key: 'mob.tw.err_committee_many', params: { max: 10 } },
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'USER_UNAVAILABLE', user_id: 'u9', step: 5 }), rctx)).toMatchObject({
      dropUserId: 'u9',
    });
    expect(mapCreateRejection(reject(422, { code: 'COMMITTEE_INVALID', reason: 'DUPLICATE', user_id: 'u9', step: 5 }), rctx)).toMatchObject({
      issue: { key: 'mob.tw.err_committee_duplicate' },
    });
  });

  it('a template or override failure is not something the organizer can change: it stays on review', () => {
    expect(mapCreateRejection(reject(409, { code: 'TEMPLATE_NOT_ACTIVE', field: 'template_id', step: 1 }), rctx)).toMatchObject({
      kind: 'failed',
      issue: { key: 'mob.tw.err_template_unavailable' },
    });
    expect(mapCreateRejection(reject(404, { code: 'TEMPLATE_NOT_FOUND', step: 1 }), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(422, { code: 'OVERRIDES_INVALID', step: 1 }), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(422, { code: 'VENUE_INVALID', step: 1 }), rctx)).toMatchObject({ step: WIZARD_STEP.when });
  });

  it('v2 disabled, network drops and unknown bodies stay on review', () => {
    expect(mapCreateRejection(reject(409, { detail: 'v2 tournament creation is disabled' }), rctx).kind).toBe('disabled');
    expect(mapCreateRejection(new Error('Network Error'), rctx)).toMatchObject({ kind: 'failed', issue: { key: 'mob.tw.err_create_failed' } });
    expect(mapCreateRejection(reject(500, undefined), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(422, { detail: [{ loc: ['body'], msg: 'x' }] }), rctx).kind).toBe('failed');
    expect(mapCreateRejection(reject(503, { code: 'TOURNAMENT_CONFIG_INVALID' }), rctx).kind).toBe('failed');
  });

  it('server step numbers (te-b1: Basics 1, Participation 2, Dates 3, Groups 4, Committee 5) translate to screens', () => {
    expect([1, 2, 4, 5].map(step => boardStepFor(step, undefined))).toEqual([WIZARD_STEP.when, WIZARD_STEP.participation, WIZARD_STEP.visibility, WIZARD_STEP.committee]);
    expect(boardStepFor(6, undefined)).toBeNull();
    expect(boardStepFor(3, 'ends_at')).toBe(WIZARD_STEP.when);
    expect(boardStepFor(3, 'registration_hard_block_at')).toBe(WIZARD_STEP.registration);
    expect(boardStepFor(undefined, undefined)).toBeNull();
  });
});

describe('venue_detail and focus (te-a4, AD-T13)', () => {
  it('the court or hall text is trimmed, sent only when it has content, and counted after trimming', () => {
    expect(buildCreateBody(validState(), false)).not.toHaveProperty('venue_detail');
    expect(buildCreateBody(validState({ venueDetail: '   ' }), false)).not.toHaveProperty('venue_detail');
    expect(buildCreateBody(validState({ venueDetail: '  Court 2 ' }), false).venue_detail).toBe('Court 2');
    expect(validateVenue(validState({ venueDetail: 'x'.repeat(VENUE_DETAIL_MAX) }), false)).toEqual([]);
    expect(validateVenue(validState({ venueDetail: ` ${'x'.repeat(VENUE_DETAIL_MAX)} ` }), false)).toEqual([]);
    expect(validateVenue(validState({ venueDetail: 'x'.repeat(VENUE_DETAIL_MAX + 1) }), false)).toEqual([
      { key: 'mob.tw.err_venue_detail_too_long', field: 'venue_detail', step: WIZARD_STEP.when },
    ]);
  });

  it('VENUE_DETAIL_TOO_LONG goes back to When and where on the court field', () => {
    const out = mapCreateRejection(
      { response: { status: 422, data: { code: 'VENUE_DETAIL_TOO_LONG', field: 'venue_detail', reason: 'too_long', step: 1 } } },
      { committeeMax: 10, startLabel: '' },
    );
    expect(out).toEqual({ kind: 'step', step: WIZARD_STEP.when, issue: { key: 'mob.tw.err_venue_detail_too_long', field: 'venue_detail', step: WIZARD_STEP.when } });
  });

  it('focus goes to the first field of each step, or to the first field with an error', () => {
    expect(firstFocusField(WIZARD_STEP.basics, {})).toBe('title');
    expect(firstFocusField(WIZARD_STEP.basics, { description: 'x', title: 'y' })).toBe('title');
    expect(firstFocusField(WIZARD_STEP.basics, { description: 'x' })).toBe('description');
    expect(firstFocusField(WIZARD_STEP.participation, {})).toBe('participation');
    expect(firstFocusField(WIZARD_STEP.when, {})).toBe('starts_at');
    expect(firstFocusField(WIZARD_STEP.when, { venue: 'v', ends_at: 'e' })).toBe('ends_at');
    expect(firstFocusField(WIZARD_STEP.when, { venue_detail: 'd', venue: 'v' })).toBe('venue');
    expect(firstFocusField(WIZARD_STEP.registration, { registration_hard_block_at: 'h' })).toBe('registration_hard_block_at');
    expect(firstFocusField(WIZARD_STEP.registration, {})).toBe('registration_closes_at');
    expect(firstFocusField(WIZARD_STEP.visibility, { group_ids: 'x' })).toBe('visibility');
    expect(firstFocusField(WIZARD_STEP.committee, {})).toBe('committee_add');
    expect(firstFocusField(WIZARD_STEP.review, {})).toBe('heading');
  });
});
