/**
 * Tournament creation wizard (DES-MEETUP-ADDENDUM-tournament-lifecycle AD-20, AD-19; task tl-c-mobile-2 PR 1).
 *
 * Eight board steps (Basics, Format, Participation, When and where, Registration, Visibility, Committee, Review) then
 * the Created screen. The client holds all state (BP-12: no server draft), submits once to
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
import { createWizardTournament, getWizardTemplates } from '../api/tournaments';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import Button from '../components/Button';
import BasicsStep from '../components/tournament/wizard/BasicsStep';
import CommitteePicker from '../components/tournament/wizard/CommitteePicker';
import CommitteeStep from '../components/tournament/wizard/CommitteeStep';
import CreatedView from '../components/tournament/wizard/CreatedView';
import DiscardDialog from '../components/tournament/wizard/DiscardDialog';
import FormatStep from '../components/tournament/wizard/FormatStep';
import ParticipationStep from '../components/tournament/wizard/ParticipationStep';
import RegistrationStep, { formatDay } from '../components/tournament/wizard/RegistrationStep';
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
import type { WizardCreateResult, WizardTemplate, WizardTemplatesResponse } from '../types/tournamentWizard';
import {
  FALLBACK_LIMITS,
  WIZARD_STEP,
  WIZARD_TOTAL_STEPS,
  applyTemplateDefaults,
  buildCreateBody,
  findTemplate,
  firstInvalidStep,
  initialWizardState,
  listableTemplates,
  mapCreateRejection,
  toDate,
  validateStep,
  withClosure,
  withHardBlock,
  type WizardContext,
  type WizardIssue,
  type WizardState,
} from '../utils/tournamentWizard';

type Props = NativeStackScreenProps<HomeStackParamList, 'TournamentWizard'>;

type View_ = 'wizard' | 'committee-picker' | 'created';

/** Issues that only mean "not filled in yet": shown after the first Next on that step. */
const NEEDS_INPUT = new Set<LabelKey>([
  'mob.tw.err_sport',
  'mob.tw.err_title',
  'mob.tw.err_required',
  'mob.tw.err_venue',
  'mob.tw.err_format',
  'mob.tw.err_count_required',
]);


export default function TournamentWizardScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const [response, setResponse] = useState<WizardTemplatesResponse>(route.params.templates);
  const [templatesError, setTemplatesError] = useState(false);
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsError, setSportsError] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsError, setGroupsError] = useState(false);
  const [catalogueEnabled, setCatalogueEnabled] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>(() => initialWizardState(generateCorrelationId()));
  const [step, setStep] = useState<number>(WIZARD_STEP.basics);
  const [view, setView] = useState<View_>('wizard');
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [serverIssue, setServerIssue] = useState<WizardIssue | null>(null);
  const [retired, setRetired] = useState<{ name: string; version: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitIssue, setSubmitIssue] = useState<WizardIssue | null>(null);
  const [created, setCreated] = useState<WizardCreateResult | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const allowLeave = useRef(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const submitLock = useRef(false);
  // Fixed for the life of the screen: "Today" and the past-date checks.
  const [now] = useState(() => new Date());

  const templates = useMemo(() => listableTemplates(response), [response]);
  const limits = response.limits ?? FALLBACK_LIMITS;
  const template = findTemplate(templates, state.templateId);
  const sport = sports.find(item => item.name === state.sport);

  const ctx: WizardContext = useMemo(
    () => ({ templates, limits, catalogueEnabled, now, formatDay }),
    [templates, limits, catalogueEnabled, now],
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
  const loadTemplates = useCallback(() => {
    getWizardTemplates()
      .then(next => {
        setResponse(next);
        setTemplatesError(false);
      })
      .catch(() => setTemplatesError(true));
  }, []);

  useEffect(() => {
    loadSports();
    loadGroups();
    getClientConfig()
      .then(config => {
        setMapsApiKey(config.google_maps_api_key);
        setCatalogueEnabled(Boolean(config.venue_catalogue_enabled));
      })
      .catch(() => {});
  }, [loadSports, loadGroups]);

  // ---- leaving: discard confirmation (board TournDiscard) ---------------------------------------------------
  const dirty =
    state.title.trim() !== '' ||
    state.description.trim() !== '' ||
    state.templateId !== null ||
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

  const selectTemplate = (next: WizardTemplate): void => {
    setRetired(null);
    setServerIssue(null);
    setState(current => (current.templateId === next.id ? current : applyTemplateDefaults(current, next)));
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
        out[field] = t(issue.key, withRetiredValues(issue));
      }
    });
    return out;
  };
  function withRetiredValues(issue: WizardIssue): Record<string, string | number> | undefined {
    if (issue.key === 'mob.tw.err_format_retired' && retired) {
      return { name: retired.name, version: retired.version };
    }
    return issue.params;
  }

  const stepIssues = issuesFor(step);
  // The committee board shows its minimum error, and a disabled Next, on arrival (TournCommitteeMin).
  const stepBlocked =
    view === 'wizard' &&
    stepIssues.length > 0 &&
    (attempted[step] || Boolean(serverIssue) || step === WIZARD_STEP.committee);
  const formatKnown = templates.length > 0 && !templatesError;

  const goNext = (): void => {
    const issues = validateStep(step, state, ctx);
    if (issues.length > 0) {
      setAttempted(current => ({ ...current, [step]: true }));
      return;
    }
    setServerIssue(null);
    setStep(current => Math.min(current + 1, WIZARD_STEP.review));
  };

  const goBack = (): void => {
    setServerIssue(null);
    setSubmitIssue(null);
    if (view === 'committee-picker') {
      setView('wizard');
      return;
    }
    if (step > WIZARD_STEP.basics) {
      setStep(current => current - 1);
    } else {
      navigation.goBack();
    }
  };

  // ---- submit -------------------------------------------------------------------------------------------
  const rejectionContext = (): { minGapHours: number; committeeMax: number; startLabel: string; hardBlockAtOrAfterStart: boolean } => {
    const starts = toDate(state.startsAt);
    const hard = toDate(state.hardBlockAt);
    return {
      minGapHours: limits.min_gap_hours,
      committeeMax: limits.committee_max,
      startLabel: starts ? formatDay(starts) : '',
      hardBlockAtOrAfterStart: Boolean(starts && hard && hard.getTime() >= starts.getTime()),
    };
  };

  const submit = async (): Promise<void> => {
    if (submitLock.current) {
      return;
    }
    const invalid = firstInvalidStep(state, ctx);
    if (invalid !== null || !template) {
      setAttempted(current => ({ ...current, [invalid ?? WIZARD_STEP.format]: true }));
      setStep(invalid ?? WIZARD_STEP.format);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitIssue(null);
    try {
      const body = buildCreateBody(state, template, catalogueEnabled);
      const { result } = await withCorrelationId(correlationId => createWizardTournament(body, { correlationId }));
      allowLeave.current = true;
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
      } else if (outcome.kind === 'format_retired') {
        setRetired(template ? { name: template.display_name, version: template.version } : null);
        setServerIssue(outcome.issue);
        setState(current => ({ ...current, templateId: null }));
        loadTemplates();
        setStep(outcome.step);
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
        onOpen={openTournament}
      />
    );
  }

  if (view === 'committee-picker') {
    return (
      <View style={styles.screen}>
        <WizardHeader
          title={t('mob.tw.title')}
          currentStep={WIZARD_STEP.committee}
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
  const windowError = errors.starts_at && errors.starts_at === errors.ends_at ? errors.starts_at : null;
  const venueLabel = catalogueEnabled ? state.venue?.name ?? '' : state.venueName.trim();
  const retiredMessage =
    retired && serverIssue?.key === 'mob.tw.err_format_retired'
      ? t('mob.tw.err_format_retired', { name: retired.name, version: retired.version })
      : null;

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
          />
        );
      case WIZARD_STEP.format:
        return (
          <FormatStep
            templates={templates}
            selectedId={state.templateId}
            onSelect={selectTemplate}
            sportLabel={sport?.display_name ?? state.sport}
            loadError={templatesError}
            onRetry={loadTemplates}
            retiredMessage={retiredMessage}
            error={retiredMessage ? undefined : errors.template_id}
          />
        );
      case WIZARD_STEP.participation:
        return template ? (
          <ParticipationStep
            state={state}
            template={template}
            onChange={update}
            errors={stepIssues
              .filter(issue => attempted[step] || issue.key.endsWith('_order') || issue.key === 'mob.tw.err_overrides')
              .map(issue => t(issue.key, issue.params))}
          />
        ) : (
          <View />
        );
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
            errors={errors}
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
          />
        );
      default:
        return (
          <ReviewStep
            state={state}
            template={template}
            venueLabel={venueLabel}
            retiredMessage={null}
            onEdit={target => {
              setServerIssue(null);
              setStep(target);
            }}
          />
        );
    }
  };

  const isReview = step === WIZARD_STEP.review;
  const nextDisabled = submitting || stepBlocked || (step === WIZARD_STEP.format && !formatKnown);

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={t('mob.tw.title')}
        currentStep={step}
        totalSteps={WIZARD_TOTAL_STEPS}
        onBack={goBack}
      />
      <KeyboardAwareScreen contentContainerStyle={wizardStyles.content}>
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
