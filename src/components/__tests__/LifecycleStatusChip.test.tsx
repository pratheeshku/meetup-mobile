import React from 'react';
import { render, texts } from '../../test-utils/render';
import LifecycleStatusChip, { getLifecycleStatusText } from '../LifecycleStatusChip';

describe('LifecycleStatusChip', () => {
  it('renders Active for active status', () => {
    const root = render(<LifecycleStatusChip status="active" />);
    expect(texts(root)).toContain('Active');
  });

  it('renders Pending closure for past status', () => {
    const root = render(<LifecycleStatusChip status="past" />);
    expect(texts(root)).toContain('Pending closure');
  });

  it('renders Cancelled for cancelled status', () => {
    const root = render(<LifecycleStatusChip status="cancelled" />);
    expect(texts(root)).toContain('Cancelled');
  });

  it('renders Closed for closed status with completed outcome', () => {
    const root = render(<LifecycleStatusChip status="closed" outcome="completed" />);
    expect(texts(root)).toContain('Closed');
  });

  it('renders Closed · Did not take place for closed status with not_held outcome', () => {
    const root = render(<LifecycleStatusChip status="closed" outcome="not_held" />);
    expect(texts(root)).toContain('Closed · Did not take place');
  });

  it('getLifecycleStatusText maps correctly with custom translate fn', () => {
    const mockT = ((k: string) => {
      const map: Record<string, string> = {
        'mob.closure.status.active': 'Active',
        'mob.closure.status.pending': 'Pending closure',
        'mob.closure.status.cancelled': 'Cancelled',
        'mob.closure.status.closed': 'Closed',
        'mob.closure.status.not_held': 'Did not take place',
      };
      return map[k] ?? k;
    }) as any;

    expect(getLifecycleStatusText('active', undefined, mockT)).toBe('Active');
    expect(getLifecycleStatusText('past', undefined, mockT)).toBe('Pending closure');
    expect(getLifecycleStatusText('cancelled', undefined, mockT)).toBe('Cancelled');
    expect(getLifecycleStatusText('closed', undefined, mockT)).toBe('Closed');
    expect(getLifecycleStatusText('closed', 'not_held', mockT)).toBe('Closed · Did not take place');
  });
});
