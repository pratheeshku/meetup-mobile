/**
 * Venue row in the tournament list card (team-screens-remarks AD-6, TS-13): the name and address column fills the width to the right of the
 * pin and the address wraps up to three lines before truncating. Jest cannot measure layout, so the fault is reproduced from the code: with a
 * long address the column is capped at two lines and the rest of the address is cut off.
 */
import React from 'react';

import { render } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import VenueRow from '../VenueRow';

jest.mock('../../../api/venues', () => ({
  deleteVenueImage: jest.fn(),
  getVenue: jest.fn(),
  reportVenueImage: jest.fn(),
  uploadGameVenueImage: jest.fn(),
  uploadTournamentVenueImage: jest.fn(),
}));

const LONG_ADDRESS =
  'Kallang Sports Hub, Multi-Purpose Hall Level 2, 52 Stadium Walk, Kallang Road Entrance via Gate B opposite the Indoor Stadium, Singapore 397691';
const byId = (root: Instance, id: string): Instance => root.find(n => n.props.testID === id && typeof n.type === 'string');
const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...([] as unknown[]).concat(style ?? []).flat(5).filter(Boolean));

const mount = (): Instance =>
  render(
    <VenueRow
      snapshot={{ name: 'Kallang Sports Hub Multi-Purpose Hall', address: LONG_ADDRESS, lat: null, lng: null, source: 'catalogue' }}
      fallbackText="x"
      showAddress
    />,
  );

describe('list-card venue row with a long address (TS-13)', () => {
  it('wraps the address up to three lines before truncating', () => {
    expect(LONG_ADDRESS.length).toBeGreaterThan(120);
    const root = mount();
    expect(byId(root, 'venue-row-address').props.numberOfLines).toBe(3);
  });

  it('gives the name and address column all the width right of the pin (it may shrink below its content, never overflow)', () => {
    const root = mount();
    let column = byId(root, 'venue-row-address').parent as Instance;
    while ((column.type as unknown) !== 'View') {
      column = column.parent as Instance;
    }
    expect(flat(column.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
  });
});
