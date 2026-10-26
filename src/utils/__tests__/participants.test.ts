/** Participants helpers (teams-payments AD-9, AD-13): filtering by the server's payment state and reading a typed points value. */
import { filterByPayment, paymentStateOf, parsePointsInput, pointsText, sanitizePointsTyping } from '../participants';

const row = (paid: string | null, exempt = false) => ({ payment_received_at: paid, payment_exempt: exempt });

describe('payment state and filters', () => {
  it('exempt (the organizer), paid, unpaid', () => {
    expect(paymentStateOf(row(null, true))).toBe('exempt');
    expect(paymentStateOf(row('2026-10-26T00:00:00Z'))).toBe('paid');
    expect(paymentStateOf(row(null))).toBe('unpaid');
  });

  it('All shows everyone; Paid and Unpaid exclude the organizer row', () => {
    const rows = [row('x'), row(null), row(null, true)];
    expect(filterByPayment(rows, 'all')).toHaveLength(3);
    expect(filterByPayment(rows, 'paid')).toEqual([rows[0]]);
    expect(filterByPayment(rows, 'unpaid')).toEqual([rows[1]]);
  });
});

describe('points', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['1450', 1450],
    ['1300.5', 1300.5],
    ['0', 0],
    ['12.123456', 12.123456],
  ])('%p is %p', (text, value) => {
    expect(parsePointsInput(text)).toEqual({ valid: true, value });
  });

  it.each(['12.1234567', '-5', '1e3', 'abc', '1,5', '.5'])('%p is invalid', text => {
    expect(parsePointsInput(text)).toEqual({ valid: false });
  });

  it('shows the server text without trailing zeros', () => {
    expect(pointsText('1450.000000')).toBe('1450');
    expect(pointsText('1300.500000')).toBe('1300.5');
    expect(pointsText('1100')).toBe('1100');
    expect(pointsText(null)).toBe('');
    expect(pointsText('0.000000')).toBe('0');
  });

  it('typing keeps digits and one dot', () => {
    expect(sanitizePointsTyping('1a4.5.6')).toBe('14.56');
    expect(sanitizePointsTyping('-12')).toBe('12');
  });
});
