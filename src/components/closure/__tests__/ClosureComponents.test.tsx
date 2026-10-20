import React from 'react';
import { act, render, texts, type Instance } from '../../../test-utils/render';
import ClosureModal from '../ClosureModal';
import ClosureSummaryCard from '../ClosureSummaryCard';

const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find(node => node.props.testID === id);
  if (!match) throw new Error(`Node with testID ${id} not found`);
  return match;
};

describe('Closure components', () => {
  const candidates = [
    { id: 'u1', displayName: 'Alice' },
    { id: 'u2', displayName: 'Bob' },
    { id: 'u3', displayName: 'Charlie' },
  ];

  describe('ClosureModal', () => {
    it('renders with candidate list and switches outcome', async () => {
      const onSubmit = jest.fn();
      const onClose = jest.fn();

      const root = render(
        <ClosureModal
          visible={true}
          onClose={onClose}
          candidates={candidates}
          initialOutcome="completed"
          initialAttendeeIds={['u1', 'u2']}
          initialWinnerId="u1"
          initialRunnerUpId="u2"
          expectedVersion={0}
          onSubmit={onSubmit}
        />
      );

      expect(texts(root)).toContain('Closure report');
      expect(texts(root)).toContain('Was it played?');
      expect(texts(root)).toContain('Alice');
      expect(texts(root)).toContain('Bob');
      expect(texts(root)).toContain('Charlie');

      const saveBtn = byTestId(root, 'closure-save-button');
      await act(async () => {
        saveBtn.props.onPress();
      });

      expect(onSubmit).toHaveBeenCalledWith({
        outcome: 'completed',
        attendeeIds: expect.arrayContaining(['u1', 'u2']),
        winnerId: 'u1',
        runnerUpId: 'u2',
        expectedVersion: 0,
      });
    });

    it('shows version conflict error when passed in error prop', () => {
      const root = render(
        <ClosureModal
          visible={true}
          onClose={jest.fn()}
          candidates={candidates}
          expectedVersion={1}
          onSubmit={jest.fn()}
          error="Another user updated this closure report. Please review the updated details and try again."
        />
      );

      expect(texts(root)).toContain('Another user updated this closure report. Please review the updated details and try again.');
    });
  });

  describe('ClosureSummaryCard', () => {
    it('renders completed closure with winner, runner up and edit button', () => {
      const onEditPress = jest.fn();
      const root = render(
        <ClosureSummaryCard
          outcome="completed"
          winnerName="Alice"
          runnerUpName="Bob"
          canEdit={true}
          onEditPress={onEditPress}
        />
      );

      expect(texts(root)).toContain('Closure report');
      expect(texts(root)).toContain('Played');
      expect(texts(root)).toContain('Winner');
      expect(texts(root)).toContain('Alice');
      expect(texts(root)).toContain('Runner-up');
      expect(texts(root)).toContain('Bob');

      const editBtn = byTestId(root, 'edit-closure-button');
      act(() => {
        editBtn.props.onPress();
      });
      expect(onEditPress).toHaveBeenCalled();
    });

    it('renders not_held closure', () => {
      const root = render(
        <ClosureSummaryCard
          outcome="not_held"
          canEdit={false}
        />
      );

      expect(texts(root)).toContain('Closure report');
      expect(texts(root)).toContain('Did not take place');
      expect(texts(root)).not.toContain('Winner');
    });
  });
});
