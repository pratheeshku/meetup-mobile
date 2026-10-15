import React from 'react';

import EditMatchModal from '../EditMatchModal';
import type { TournamentFixture } from '../../../types/tournament';
import {
  act,
  pressableLabelled,
  renderAsync,
  texts,
} from '../../../test-utils/render';

const sampleFixture: TournamentFixture = {
  id: 'fixture-1',
  home_team: 'Daniel S.',
  away_team: 'Pratheesh K.',
  home_score: null,
  away_score: null,
  round: 'Round of 32',
  status: 'scheduled',
  scheduled_at: '2026-11-14T09:45:00Z',
};

describe('EditMatchModal', () => {
  it('renders match card, tournament compact venue field, date, and time matching FXEdit board', async () => {
    const onSave = jest.fn();
    const root = await renderAsync(
      <EditMatchModal
        visible={true}
        onClose={jest.fn()}
        fixture={sampleFixture}
        sportId="badminton"
        sportDisplayName="Badminton"
        venueCatalogueEnabled={true}
        onSave={onSave}
      />,
    );

    const allTexts = texts(root);
    expect(allTexts).toContain('Edit match');
    expect(allTexts).toContain('Daniel S. vs Pratheesh K.');
    expect(allTexts).toContain('Round of 32');
    expect(allTexts).toContain('Punggol Sports Hall');
    expect(allTexts).toContain('Others');
    expect(allTexts).toContain('Change only if the tournament uses another venue.');
  });

  it('shows court clash warning when Court 2 is entered matching FXEditCourt board', async () => {
    const onSave = jest.fn();
    const root = await renderAsync(
      <EditMatchModal
        visible={true}
        onClose={jest.fn()}
        fixture={sampleFixture}
        sportId="badminton"
        sportDisplayName="Badminton"
        venueCatalogueEnabled={true}
        onSave={onSave}
      />,
    );

    const courtInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'Court',
    );

    await act(async () => {
      courtInput.props.onChangeText('Court 2');
    });

    const allTexts = texts(root);
    expect(allTexts).toContain(
      'Court 2 is already used at Sat 9:45 AM. Pick another court or time.',
    );

    // Save button should be disabled when court clash exists
    const saveBtn = pressableLabelled(root, 'Save match');
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('invokes onSave with updated details when saved', async () => {
    const onSave = jest.fn();
    const root = await renderAsync(
      <EditMatchModal
        visible={true}
        onClose={jest.fn()}
        fixture={sampleFixture}
        sportId="badminton"
        sportDisplayName="Badminton"
        venueCatalogueEnabled={true}
        onSave={onSave}
      />,
    );

    const courtInput = root.find(
      n => (n.type as unknown) === 'TextInput' && n.props.placeholder === 'Court',
    );

    await act(async () => {
      courtInput.props.onChangeText('Court 3');
    });

    const saveBtn = pressableLabelled(root, 'Save match');
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        court: 'Court 3',
      }),
    );
  });
});
