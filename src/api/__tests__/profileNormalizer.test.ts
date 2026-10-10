import { normalizeSkillLevel, getSkillLevels, updateSkillLevel } from '../profile';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

describe('normalizeSkillLevel', () => {
  it('normalises lowercase canonical values', () => {
    expect(normalizeSkillLevel('beginner')).toBe('beginner');
    expect(normalizeSkillLevel('intermediate')).toBe('intermediate');
    expect(normalizeSkillLevel('expert')).toBe('expert');
  });

  it('normalises TitleCase values to canonical lowercase', () => {
    expect(normalizeSkillLevel('Beginner')).toBe('beginner');
    expect(normalizeSkillLevel('Intermediate')).toBe('intermediate');
    expect(normalizeSkillLevel('Expert')).toBe('expert');
  });

  it('normalises UPPERCASE and whitespace variants to canonical lowercase', () => {
    expect(normalizeSkillLevel(' BEGINNER ')).toBe('beginner');
    expect(normalizeSkillLevel('INTERMEDIATE')).toBe('intermediate');
    expect(normalizeSkillLevel('Expert ')).toBe('expert');
  });

  it('returns null for empty, null, undefined or unknown values', () => {
    expect(normalizeSkillLevel(null)).toBeNull();
    expect(normalizeSkillLevel(undefined)).toBeNull();
    expect(normalizeSkillLevel('')).toBeNull();
    expect(normalizeSkillLevel('unknown')).toBeNull();
  });

  it('maps case-variants on read in getSkillLevels', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [
        { sport: 'badminton', skill_level: 'Beginner' },
        { sport: 'tennis', skill_level: 'INTERMEDIATE' },
        { sport: 'basketball', skill_level: 'expert' },
      ],
    });

    const levels = await getSkillLevels();
    expect(levels).toEqual([
      { sport: 'badminton', skill_level: 'beginner', updated_at: undefined },
      { sport: 'tennis', skill_level: 'intermediate', updated_at: undefined },
      { sport: 'basketball', skill_level: 'expert', updated_at: undefined },
    ]);
  });

  it('sends lowercase canonical value on write in updateSkillLevel', async () => {
    (apiClient.put as jest.Mock).mockResolvedValueOnce({ data: {} });

    await updateSkillLevel('badminton', 'beginner');
    expect(apiClient.put).toHaveBeenCalledWith(
      '/users/me/skill-level',
      { sport: 'badminton', skill_level: 'beginner' },
      { correlationId: undefined },
    );
  });
});
