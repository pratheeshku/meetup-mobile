/**
 * Tournament creation wizard (DES-MEETUP-ADDENDUM-tournament-lifecycle AD-20, AD-19; task tl-c-mobile-2 PR 1).
 *
 * Seven screens (Basics, Participation, When and where, Registration dates, Visibility, Committee, Review) then
 * the Created screen; the Format step is gone (tournament-experience AD-T3) and the header counts the server's six
 * steps (`displayStep`). The client holds all state (BP-12: no server draft), submits once to
 * `POST /tournaments/v2/create` with one `client_request_id` per wizard session (reused on every retry), and shows
 * server rejections on the step and field the boards show. The server is the only authority for dates, caps and
 * committee rules; the client only mirrors them for early feedback.
 *
 * One correlation id per submit via `withCorrelationId()`. Opened only when `GET /tournaments/v2/templates` lists a
 * groups-and-knockout format (see `CreateGameScreen`); otherwise the v1 form stays as it is.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationAction } from '@react-navigation/native';

import { withCorrelationId, generateCorrelationId } from '../api/correlationId';
import { getClientConfig } from '../api/config';
import { getMyGroups } from '../api/groups';
import { getSports } from '../api/sports';
import { createWizardTournament, uploadTournamentImage } from '../api/tournaments';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import Button from '../components/Button';
import BasicsStep from '../components/tournament/wizard/BasicsStep';
import CommitteePicker from '../components/tournament/wizard/CommitteePicker';
import CommitteeStep from '../components/tournament/wizard/CommitteeStep';
import CreatedView from '../components/tournament/wizard/CreatedView';
import DiscardDialog from '../components/tournament/wizard/DiscardDialog';
import ParticipationStep from '../components/tournament/wizard/ParticipationStep';
import RegistrationStep, { formatDayTime } from '../components/tournament/wizard/RegistrationStep';
import ReviewStep from '../components/tournament/wizard/ReviewStep';
import VisibilityStep from '../components/tournament/wizard/VisibilityStep';
import WhenWhereStep from '../components/tournament/wizard/WhenWhereStep';
import { Banner, wizardStyles } from '../components/tournament/wizard/parts';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import type { HomeStackParamList } from '../navigation/types';
import { navigationRef } from '../notifications/notificationRouting';
import { colors, spacing } from '../theme/tokens';
import type { Group } from '../types/group';
import type { Sport } from '../types/sport';
import type { UserSearchResult } from '../types/user';
import type { WizardCreateResult, WizardTemplatesResponse } from '../types/tournamentWizard';
import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  WIZARD_TOTAL_STEPS,
  buildCreateBody,
  displayStep,
  firstFocusField,
  firstInvalidStep,
  initialWizardState,
  feeMaxText,
  mapCreateRejection,
  toDate,
  validateStep,
  withClosure,
  withHardBlock,
  type WizardContext,
  type WizardFeeConfig,
  type WizardIssue,
  type WizardState,
} from '../utils/tournamentWizard';

type Props = NativeStackScreenProps<HomeStackParamList, 'TournamentWizard'>;

type View_ = 'wizard' | 'committee-picker' | 'created';

/** Issues that only mean "not filled in yet": shown after the first Next on that step. */
const NEEDS_INPUT = new Set<LabelKey>(['mob.tw.err_sport', 'mob.tw.err_title', 'mob.tw.err_required', 'mob.tw.err_venue']);


export default function TournamentWizardScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  // Only the limits are read from the templates answer now (no Format step).
  const response: WizardTemplatesResponse = route.params.templates;
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsError, setSportsError] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsError, setGroupsError] = useState(false);
  const [catalogueEnabled, setCatalogueEnabled] = useState(false);
  // Null while the server's fee flag is off: the fee field is hidden and nothing is sent (tournament-registration AD-4).
  const [fee, setFee] = useState<WizardFeeConfig | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>(() => initialWizardState(generateCorrelationId()));
  const [step, setStep] = useState<number>(WIZARD_STEP.basics);
  const [view, setView] = useState<View_>('wizard');
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [serverIssue, setServerIssue] = useState<WizardIssue | null>(null);
  const [imagesFailed, setImagesFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitIssue, setSubmitIssue] = useState<WizardIssue | null>(null);
  const [created, setCreated] = useState<WizardCreateResult | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  // AD-T13: every step change (and every error) moves focus again; 0 until the first change.
  const [focusToken, setFocusToken] = useState(0);
  const bumpFocus = useCallback(() => setFocusToken(token => token + 1), []);

  const allowLeave = useRef(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const submitLock = useRef(false);
  // Fixed for the life of the screen: "Today" and the past-date checks.
  const [now] = useState(() => new Date());

  const limits = response.limits ?? FALLBACK_LIMITS;
  const sport = sports.find(item => item.name === state.sport);

  const ctx: WizardContext = useMemo(
    () => ({ limits, catalogueEnabled, now, formatDayTime, fee }),
    [limits, catalogueEnabled, now, fee],
  );

  // ---- loading ------------------------------------------------------------------------------------------
  const loadSports = useCallback(() => {
    getSports()
      .then(list => {
        setSports(list);
        setSportsError(false);
        setState(current => (current.sport || !list[0] ? current : { ...current, sport: list[0].name }));
      })
      .catch(() => setSportsError(true));
  }, []);
  const loadGroups = useCallback(() => {
    getMyGroups()
      .then(res => {
        setGroups(res.items);
        setGroupsError(false);
      })
      .catch(() => setGroupsError(true));
  }, []);
  useEffect(() => {
    loadSports();
    loadGroups();
    getClientConfig()
      .then(config => {
        setMapsApiKey(config.google_maps_api_key);
        setCatalogueEnabled(Boolean(config.venue_catalogue_enabled));
        setFee(
          config.tournament_fee_enabled
            ? { currency: config.tournament_fee_currency, maxCents: config.tournament_fee_max_cents }
            : null,
        );
      })
      .catch(() => {});
  }, [loadSports, loadGroups]);

  // ---- leaving: discard confirmation (board TournDiscard) ---------------------------------------------------
  const dirty =
    state.title.trim() !== '' ||
    state.description.trim() !== '' ||
    state.banner !== null ||
    state.logo !== null ||
    state.startsAt !== '' ||
    state.committee.length > 0 ||
    step > WIZARD_STEP.basics;

  useEffect(() => {
    return navigation.addListener('beforeRemove', event => {
      if (allowLeave.current || !dirty || view === 'created') {
        return;
      }
      event.preventDefault();
      pendingAction.current = event.data.action;
      setDiscardOpen(true);
    });
  }, [navigation, dirty, view]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view === 'committee-picker') {
        setView('wizard');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [view]);

  const discard = (): void => {
    allowLeave.current = true;
    setDiscardOpen(false);
    if (pendingAction.current) {
      navigation.dispatch(pendingAction.current);
    } else {
      navigation.goBack();
    }
  };

  // ---- state updates ------------------------------------------------------------------------------------
  const update = (patch: Partial<WizardState>): void => {
    setState(current => ({ ...current, ...patch }));
    setServerIssue(null);
    setSubmitIssue(null);
  };

  const toggleGroup = (groupId: string): void => {
    setServerIssue(null);
    setState(current => {
      if (current.groupIds.includes(groupId)) {
        return { ...current, groupIds: current.groupIds.filter(id => id !== groupId) };
      }
      return current.groupIds.length >= limits.audience_group_cap
        ? current
        : { ...current, groupIds: [...current.groupIds, groupId] };
    });
  };

  const addCommittee = (people: UserSearchResult[]): void => {
    setServerIssue(null);
    bumpFocus();
    setState(current => {
      const known = new Set(current.committee.map(person => person.id));
      const next = people
        .filter(person => !known.has(person.id))
        .map(person => ({ id: person.id, displayName: person.display_name }));
      return { ...current, committee: [...current.committee, ...next].slice(0, limits.committee_max - 1) };
    });
    setView('wizard');
  };

  // ---- validation and navigation ------------------------------------------------------------------------
  const issuesFor = (forStep: number): WizardIssue[] => {
    const own = validateStep(forStep, state, ctx);
    // "Still empty" issues wait for the first Next (boards TournBasics vs TournBasicsErr); rule breaches show at once.
    const shown = own.filter(issue => !NEEDS_INPUT.has(issue.key) || attempted[forStep]);
    // A server rejection stays on its step until the organizer changes something.
    return serverIssue && serverIssue.step === forStep ? [serverIssue, ...shown] : shown;
  };
  const errorsFor = (forStep: number): Record<string, string> => {
    const out: Record<string, string> = {};
    issuesFor(forStep).forEach(issue => {
      const field = issue.field ?? '_';
      if (!out[field]) {
        out[field] = t(issue.key, issue.params);
      }
    });
    return out;
  };
  const stepIssues = issuesFor(step);
  // The committee board shows its minimum error, and a disabled Next, on arrival (TournCommitteeMin).
  const stepBlocked =
    view === 'wizard' &&
    stepIssues.length > 0 &&
    (attempted[step] || Boolean(serverIssue) || step === WIZARD_STEP.committee || step === WIZARD_STEP.registration);

  const goNext = (): void => {
    const issues = validateStep(step, state, ctx);
    if (issues.length > 0) {
      setAttempted(current => ({ ...current, [step]: true }));
      bumpFocus();
      return;
    }
    setServerIssue(null);
    setStep(current => Math.min(current + 1, WIZARD_STEP.review));
    bumpFocus();
  };

  const goBack = (): void => {
    setServerIssue(null);
    setSubmitIssue(null);
    if (view === 'committee-picker') {
      setView('wizard');
      bumpFocus();
      return;
    }
    if (step > WIZARD_STEP.basics) {
      setStep(current => current - 1);
      bumpFocus();
    } else {
      navigation.goBack();
    }
  };

  // ---- submit -------------------------------------------------------------------------------------------
  const rejectionContext = (): { committeeMax: number; startLabel: string; feeMaxText: string } => {
    const starts = toDate(state.startsAt);
    return { committeeMax: limits.committee_max, startLabel: starts ? formatDayTime(starts) : '', feeMaxText: feeMaxText(fee) };
  };

  const submit = async (): Promise<void> => {
    if (submitLock.current) {
      return;
    }
    const invalid = firstInvalidStep(state, ctx);
    if (invalid !== null) {
      setAttempted(current => ({ ...current, [invalid]: true }));
      setStep(invalid);
      bumpFocus();
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitIssue(null);
    try {
      const body = buildCreateBody(state, catalogueEnabled, fee !== null);
      // One user action, one correlation id: the create and the two uploads share it (AD-T1). An upload that fails
      // never undoes the creation: the default shows and the organizer is told on the Created screen.
      const { result, failedImages } = await withCorrelationId(async correlationId => {
        const created_ = await createWizardTournament(body, { correlationId });
        let failed = false;
        for (const [kind, image] of [
          ['banner', state.banner],
          ['logo', state.logo],
        ] as const) {
          if (!image) {
            continue;
          }
          try {
            await uploadTournamentImage(
              created_.result.id,
              kind,
              { uri: image.path, name: image.filename, type: image.mime },
              { correlationId },
            );
          } catch {
            failed = true;
          }
        }
        return { result: created_.result, failedImages: failed };
      });
      allowLeave.current = true;
      setImagesFailed(failedImages);
      setCreated(result);
      setView('created');
    } catch (error) {
      const outcome = mapCreateRejection(error, rejectionContext());
      if (outcome.kind === 'step') {
        setServerIssue(outcome.issue);
        setAttempted(current => ({ ...current, [outcome.step]: true }));
        if (outcome.dropGroupId) {
          setState(current => ({ ...current, groupIds: current.groupIds.filter(id => id !== outcome.dropGroupId) }));
        }
        if (outcome.dropUserId) {
          setState(current => ({ ...current, committee: current.committee.filter(person => person.id !== outcome.dropUserId) }));
        }
        setStep(outcome.step);
        bumpFocus();
      } else {
        setSubmitIssue(outcome.issue);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const openTournament = (): void => {
    if (!created) {
      return;
    }
    allowLeave.current = true;
    const refreshKey = Date.now();
    navigation.popToTop();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Home', { screen: 'EventsList', params: { refreshKey }, pop: true });
      navigationRef.navigate('Tournaments', {
        screen: 'TournamentDetail',
        params: { tournamentId: created.id },
        pop: true,
      });
    }
  };

  // ---- render -------------------------------------------------------------------------------------------
  if (view === 'created' && created) {
    return (
      <CreatedView
        result={created}
        hasInvitedCommittee={created.committee.some(row => !row.is_organizer)}
        imagesFailed={imagesFailed}
        onOpen={openTournament}
      />
    );
  }

  if (view === 'committee-picker') {
    return (
      <View style={styles.screen}>
        <WizardHeader
          title={t('mob.tw.title')}
          currentStep={displayStep(WIZARD_STEP.committee)}
          totalSteps={WIZARD_TOTAL_STEPS}
          onBack={goBack}
        />
        <CommitteePicker
          excludeUserIds={state.committee.map(person => person.id)}
          remaining={limits.committee_max - 1 - state.committee.length}
          onDone={addCommittee}
        />
        <DiscardDialog visible={discardOpen} onDiscard={discard} onKeep={() => setDiscardOpen(false)} />
      </View>
    );
  }

  const errors = errorsFor(step);
  const stepFocus = { field: firstFocusField(step, errors), token: focusToken };
  const windowError = errors.starts_at && errors.starts_at === errors.ends_at ? errors.starts_at : null;
  const venueLabel = catalogueEnabled ? state.venue?.name ?? '' : state.venueName.trim();

  const renderStep = (): React.JSX.Element => {
    switch (step) {
      case WIZARD_STEP.basics:
        return (
          <BasicsStep
            state={state}
            sports={sports}
            sportsError={sportsError}
            onRetrySports={loadSports}
            onChange={update}
            errors={errors}
            focus={stepFocus}
          />
        );
      case WIZARD_STEP.participation:
        return <ParticipationStep state={state} onChange={update} focus={stepFocus} />;
      case WIZARD_STEP.when:
        return (
          <WhenWhereStep
            state={state}
            sport={sport}
            catalogueEnabled={catalogueEnabled}
            mapsApiKey={mapsApiKey}
            onChange={update}
            errors={errors}
            windowError={windowError}
            focus={stepFocus}
          />
        );
      case WIZARD_STEP.registration:
        return (
          <RegistrationStep
            state={state}
            now={now}
            onClosure={value => {
              setServerIssue(null);
              setState(current => withClosure(current, value));
            }}
            onHardBlock={value => {
              setServerIssue(null);
              setState(current => withHardBlock(current, value));
            }}
            fee={fee}
            onFee={value => {
              setServerIssue(null);
              setState(current => ({ ...current, feeAmount: value.replace(/[^0-9.]/g, '') }));
            }}
            onPayee={e164 => {
              setServerIssue(null);
              setState(current => (current.payeeNumber === e164 ? current : { ...current, payeeNumber: e164 }));
            }}
            errors={errors}
            focus={stepFocus}
          />
        );
      case WIZARD_STEP.visibility:
        return (
          <VisibilityStep
            state={state}
            groups={groups}
            groupsError={groupsError}
            onRetryGroups={loadGroups}
            cap={limits.audience_group_cap}
            onChange={update}
            onToggleGroup={toggleGroup}
            serverError={serverIssue && serverIssue.step === WIZARD_STEP.visibility ? t(serverIssue.key, serverIssue.params) : null}
            focus={stepFocus}
          />
        );
      case WIZARD_STEP.committee:
        return (
          <CommitteeStep
            state={state}
            onRemove={userId => {
              setServerIssue(null);
              setState(current => ({ ...current, committee: current.committee.filter(person => person.id !== userId) }));
            }}
            onOpenPicker={() => setView('committee-picker')}
            errorMessage={stepIssues[0] ? t(stepIssues[0].key, stepIssues[0].params) : null}
            max={limits.committee_max - 1 - state.committee.length}
            focus={stepFocus}
          />
        );
      default:
        return (
          <ReviewStep
            state={state}
            venueLabel={venueLabel}
            onEdit={target => {
              setServerIssue(null);
              setStep(target);
              bumpFocus();
            }}
            focus={stepFocus}
          />
        );
    }
  };

  const isReview = step === WIZARD_STEP.review;
  const nextDisabled = submitting || stepBlocked;

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={t('mob.tw.title')}
        currentStep={displayStep(step)}
        totalSteps={WIZARD_TOTAL_STEPS}
        onBack={goBack}
      />
      <KeyboardAwareScreen contentContainerStyle={wizardStyles.content} scrollToTopKey={focusToken}>
        {renderStep()}
      </KeyboardAwareScreen>
      {isReview && submitIssue ? (
        <View style={styles.submitError}>
          <Banner tone="error" message={t(submitIssue.key, submitIssue.params)} testID="tw-submit-error" />
        </View>
      ) : null}
      {isReview ? (
        <View style={styles.footer}>
          <Button
            label={t('mob.tw.submit')}
            variant="cta"
            onPress={submit}
            loading={submitting}
            disabled={submitting}
            testID="tw-submit"
          />
        </View>
      ) : (
        <WizardFooter onNext={goNext} nextDisabled={nextDisabled} />
      )}
      <DiscardDialog visible={discardOpen} onDiscard={discard} onKeep={() => setDiscardOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  footer: { padding: spacing.md },
  submitError: { paddingHorizontal: spacing.md },
});
