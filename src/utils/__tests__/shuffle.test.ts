/** priority1-nov23 P1-02: the Home groups panel picks 4 at random without touching the server list. */
import { pickRandom } from '../shuffle';

describe('pickRandom', () => {
  it('returns `count` distinct items from the list and leaves the input unchanged', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f'];
    const picked = pickRandom(list, 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked).size).toBe(4);
    picked.forEach(item => expect(list).toContain(item));
    expect(list).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('returns every item when there are fewer than `count`', () => {
    expect(pickRandom(['x', 'y'], 4).sort()).toEqual(['x', 'y']);
    expect(pickRandom([], 4)).toEqual([]);
  });

  it('is a real shuffle: the order follows the random source', () => {
    // random() always 0: each step swaps position i with 0 -> a known permutation, not the input order.
    expect(pickRandom(['a', 'b', 'c', 'd'], 4, () => 0)).toEqual(['b', 'c', 'd', 'a']);
    // random() just under 1: j === i every step -> the input order.
    expect(pickRandom(['a', 'b', 'c', 'd'], 4, () => 0.999)).toEqual(['a', 'b', 'c', 'd']);
  });
});
