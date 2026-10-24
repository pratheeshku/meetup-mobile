import { Platform } from 'react-native';
import { pick, saveDocuments } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { apiClient } from '../../api/client';
import { normaliseScoringState } from '../tournamentScoring';
import {
  bytesToBase64,
  discardPicked,
  downloadAndShare,
  pickWorkbook,
} from '../fileTransfer';
import {
  drawChoice,
  errLabelKey,
  normaliseDraft,
  publicationPending,
  readUploadRefusal,
  refusalView,
} from '../fixturesSetup';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn() } }));

describe('bytesToBase64', () => {
  it('matches the standard encoding for every padding case', () => {
    const enc = (text: string): string => bytesToBase64(new Uint8Array([...text].map(c => c.charCodeAt(0))));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg==');
    expect(enc('fo')).toBe('Zm8=');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('foobar')).toBe('Zm9vYmFy');
    expect(bytesToBase64(new Uint8Array([0xff, 0xfe, 0xfd, 0x00]))).toBe('//79AA==');
  });
});

describe('file handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('picks one .xlsx, and a cancelled picker is "nothing picked"', async () => {
    (pick as jest.Mock).mockResolvedValueOnce([{ uri: 'file:///tmp/p.xlsx', name: 'p.xlsx', size: 18000, error: null }]);
    expect(await pickWorkbook()).toEqual({ uri: 'file:///tmp/p.xlsx', name: 'p.xlsx', size: 18000 });
    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ type: [expect.stringContaining('spreadsheetml')], mode: 'import', allowMultiSelection: false }));
    (pick as jest.Mock).mockRejectedValueOnce({ code: 'OPERATION_CANCELED' });
    expect(await pickWorkbook()).toBeNull();
    (pick as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(pickWorkbook()).rejects.toThrow('boom');
  });

  it('deletes the picker\'s own copy after the upload, and leaves a content:// source alone', async () => {
    await discardPicked('file:///tmp/p.xlsx');
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith('/tmp/p.xlsx');
    await discardPicked('content://downloads/1');
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('downloads through the shared client with the correlation id, writes the cache file and opens the iOS share sheet', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: new Uint8Array([102, 111, 111]).buffer });
    await downloadAndShare('/tournaments/t1/points/template', 'cup-points.xlsx', 'cid-1');
    expect(apiClient.get).toHaveBeenCalledWith('/tournaments/t1/points/template', { responseType: 'arraybuffer', correlationId: 'cid-1' });
    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith('/cache/cup-points.xlsx', 'Zm9v', 'base64');
    expect(ReactNativeBlobUtil.ios.presentOptionsMenu).toHaveBeenCalledWith('/cache/cup-points.xlsx');
    expect(saveDocuments).not.toHaveBeenCalled();
  });

  it('on Android the file goes to the save dialog', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: new Uint8Array([1]).buffer });
    await downloadAndShare('/x', 'a.xlsx', 'cid');
    expect(saveDocuments).toHaveBeenCalledWith(expect.objectContaining({ sourceUris: ['file:///cache/a.xlsx'], fileName: 'a.xlsx', copy: true }));
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });
});

describe('refusals', () => {
  const err = (status: number, data: unknown) => ({ response: { status, data } });

  it('reads the 422 of a points upload: headline code and rows', () => {
    const refusal = readUploadRefusal(
      err(422, { detail: 'The file was not accepted; nothing was stored', code: 'POINTS_UPLOAD_INVALID', error_count: 53, errors: [{ row: 12, column: 'Points', code: 'POINTS_NEGATIVE' }, { row: 7, column: 'Points', code: 'POINTS_NOT_NUMERIC' }, { row: null, column: null, code: 'POINTS_UPLOAD_INVALID' }] }),
    );
    expect(refusal.code).toBe('POINTS_UPLOAD_INVALID');
    const view = refusalView(refusal);
    expect(view.headlineKey).toBe('mob.scoring.err.POINTS_UPLOAD_INVALID');
    expect(view.sections[0].rows.map(r => r.row)).toEqual([7, 12]);
    expect(view.fileLevel).toEqual([]);
    expect(view.more).toBe(50);
  });

  it('reads a file-level code, a nested detail, and maps unknown codes to the generic text', () => {
    expect(refusalView(readUploadRefusal(err(422, { code: 'FILE_TOO_LARGE', errors: [{ row: null, code: 'FILE_TOO_LARGE' }] }))).headlineKey).toBe('mob.scoring.err.FILE_TOO_LARGE');
    expect(readUploadRefusal(err(409, { detail: { code: 'WORKBOOK_STALE', message: 'x' } })).code).toBe('WORKBOOK_STALE');
    expect(errLabelKey('WORKBOOK_STALE')).toBe('mob.scoring.err.WORKBOOK_STALE');
    expect(errLabelKey('CORRECTION_NEEDS_APPROVAL')).toBe('mob.scoring.err.CORRECTION_NEEDS_APPROVAL');
    expect(errLabelKey('MATCH_TIED')).toBe('mob.scoring.err.MATCH_TIED');
    expect(errLabelKey('SOMETHING_NEW')).toBe('mob.scoring.err.UNKNOWN');
    expect(errLabelKey('RESULTS_LOCKED')).toBe('mob.tournament.score.err.RESULTS_LOCKED');
  });

  it('shows the server\'s own sentence when it sent a code the app has no words for', () => {
    const view = refusalView(readUploadRefusal(err(400, { detail: 'Odd refusal', code: 'NEW_CODE' })));
    expect(view.headlineKey).toBeNull();
    expect(view.headlineText).toBe('Odd refusal');
  });

  it('a network failure has no status', () => {
    expect(readUploadRefusal(new Error('network')).status).toBe(0);
  });
});

describe('the draft', () => {
  const raw = {
    draft_id: 'd1',
    version: 2,
    status: 'draft',
    payload_hash: 'h1',
    groups: 2,
    advance_per_group: 2,
    match_count: 3,
    payload: {
      fixture: {
        entrants: [{ entrant_id: 'r1', rank: 1 }, { entrant_id: 'r2', rank: 4 }, { entrant_id: 'r3', rank: 2 }],
        stages: [
          { stage_id: 'sB', kind: 'group', group_key: 'B', entrant_ids: ['r3'] },
          { stage_id: 'sA', kind: 'group', group_key: 'A', entrant_ids: ['r1', 'r2'] },
          { stage_id: 'sK', kind: 'knockout' },
        ],
        matches: [
          { stage_id: 'sK', round: 2, ordinal: 1, a: { kind: 'group_place', group_key: 'A', place: 1 }, b: { kind: 'group_place', group_key: 'B', place: 2 } },
          { stage_id: 'sA', round: 1, ordinal: 1, a: { kind: 'entrant', entrant_id: 'r1' }, b: { kind: 'entrant', entrant_id: 'r2' }, schedule: { start: '2026-11-14T01:00:00Z', court: 'Court 1' } },
          { stage_id: 'sA', round: 2, ordinal: 1, a: { kind: 'entrant', entrant_id: 'r1' }, b: { kind: 'bye' } },
        ],
      },
    },
  };

  it('reads groups with the draft\'s own seeds, drops rest slots and orders group matches before knockouts', () => {
    const draft = normaliseDraft(raw)!;
    expect(draft.groupList.map(g => g.key)).toEqual(['A', 'B']);
    expect(draft.groupList[0].members).toEqual([{ entrantId: 'r1', seed: 1 }, { entrantId: 'r2', seed: 4 }]);
    expect(draft.matches.map(m => m.knockout)).toEqual([false, true]);
    expect(draft.groupMatches).toBe(1);
    expect(draft.knockoutMatches).toBe(1);
    expect(draft.matches[0]).toMatchObject({ court: 'Court 1', a: { kind: 'entrant', entrantId: 'r1' } });
    expect(draft.matchCount).toBe(3);
    expect(draft.payloadHash).toBe('h1');
    expect(normaliseDraft({})).toBeNull();
  });
});

describe('the draw controls offer only what the server allows', () => {
  const options = { suggested: 4, allowed: [2, 4], advance_per_group_allowed: [1, 2] };

  it('starts on the server\'s suggestion and the last advance option, and keeps a valid pick', () => {
    expect(drawChoice(options, null, { groupCount: null, advance: null })).toEqual({ groupCounts: [2, 4], advanceOptions: [1, 2], groupCount: 4, advance: 2 });
    expect(drawChoice(options, null, { groupCount: 2, advance: 1 })).toMatchObject({ groupCount: 2, advance: 1 });
  });

  it('a pick the server does not allow is ignored (nothing is hard-coded); the open draft\'s advance is the fallback', () => {
    expect(drawChoice(options, { advance_per_group: 1 }, { groupCount: 8, advance: 3 })).toMatchObject({ groupCount: 4, advance: 1 });
    expect(drawChoice(null, null, { groupCount: 2, advance: 1 })).toEqual({ groupCounts: [], advanceOptions: [], groupCount: null, advance: null });
  });
});

describe('waiting for approval is read from the server\'s requests', () => {
  const requests = [
    { action_type: 'fixture_publication', status: 'pending', command_payload: { draft_id: 'D1' }, created_at: '2026-11-13T01:00:00Z' },
    { action_type: 'fixture_publication', status: 'rejected', command_payload: { draft_id: 'd2' } },
  ];
  it('is pending only for a pending request of this draft', () => {
    expect(publicationPending(requests, 'd1')).toEqual({ pending: true, createdAt: '2026-11-13T01:00:00Z' });
    expect(publicationPending(requests, 'd2').pending).toBe(false);
    expect(publicationPending([], 'd1').pending).toBe(false);
  });
});

describe('the committee block of the scoring state', () => {
  it('carries points, the latest draft and the allowed options exactly as sent, and nothing for a viewer without it', () => {
    const state = normaliseScoringState({
      enabled: true,
      applicable: true,
      is_committee: true,
      committee: {
        points: { entrants: 24, rated: 20, unrated: 4, locked: false, uploaded_at: '2026-11-13T00:00:00Z', file_sha256: 'x' },
        latest_draft: { draft_id: 'd1', version: 2, status: 'draft', payload_hash: 'h', groups: 4, advance_per_group: 2, created_at: 'c' },
        group_options: { suggested: 4, allowed: [2, 4], advance_per_group_allowed: [1, 2] },
      },
    });
    expect(state?.is_committee).toBe(true);
    expect(state?.committee?.points).toEqual({ entrants: 24, rated: 20, unrated: 4, locked: false, uploaded_at: '2026-11-13T00:00:00Z' });
    expect(state?.committee?.latest_draft?.payload_hash).toBe('h');
    expect(state?.committee?.group_options?.allowed).toEqual([2, 4]);
    const viewer = normaliseScoringState({ enabled: true, applicable: true, is_committee: false, committee: null });
    expect(viewer?.committee).toBeUndefined();
  });
});
