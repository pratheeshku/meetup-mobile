/**
 * Words for the matches of the Fixtures and Standings bodies, from what the server sent: the round of a knockout match,
 * its number within the round, and the text of a slot that has no name yet (a group place, or the winner or loser of an
 * earlier match). Nothing is decided here.
 */
import type { TranslateFn } from '../../../../labels/LabelsContext';
import type { ScoringMatch, ScoringSide, TournamentStandingsView } from '../../../../types/tournamentScoring';
import { roundTitle } from '../../../../utils/tournamentTabs';

function roundOf(match: ScoringMatch, view: TournamentStandingsView | null): ScoringMatch[] {
  return (view?.knockout ?? [])
    .filter(m => m.stage === match.stage && m.round_number === match.round_number)
    .sort((a, b) => a.fixture_order - b.fixture_order);
}

/** "Semi-final 1", "Final", "Round of 16 3": the round, then the position inside it unless the round has one match. */
export function knockoutName(match: ScoringMatch, view: TournamentStandingsView | null, t: TranslateFn): string {
  const siblings = roundOf(match, view);
  const title = roundTitle(match.stage, Math.max(siblings.length, 1));
  const round = t(title.key, title.count !== null ? { count: title.count } : undefined);
  if (match.stage === 'final' || match.stage === 'third_place' || siblings.length <= 1) {
    return round;
  }
  const index = siblings.findIndex(m => m.fixture_id === match.fixture_id);
  return t('mob.tournament.knockouts.match_n', { round, n: index + 1 });
}

function matchById(view: TournamentStandingsView | null, matchId: string): ScoringMatch | null {
  return (view?.knockout ?? []).find(m => m.match_id === matchId) ?? null;
}

/** The name of a side, or the words of its slot ("Group B, place 2", "Winner Semi-final 1"). */
export function slotText(side: ScoringSide, view: TournamentStandingsView | null, t: TranslateFn): string {
  if (side.name) {
    return side.name;
  }
  const detail = side.placeholder_detail;
  if (detail?.type === 'group_place') {
    return t('mob.tournament.knockouts.slot_group_place', { group: detail.group, n: detail.place });
  }
  if (detail && (detail.type === 'winner' || detail.type === 'loser') && detail.match_id) {
    const feeder = matchById(view, detail.match_id);
    const label = feeder ? knockoutName(feeder, view, t) : detail.match_id;
    return t(detail.type === 'winner' ? 'mob.tournament.knockouts.slot_winner' : 'mob.tournament.knockouts.slot_loser', { match: label });
  }
  return t('mob.tournament.fixtures.waiting_sides');
}
