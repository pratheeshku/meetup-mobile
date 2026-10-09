/**
 * AD-9 chip behaviour, EXECUTED through a probe component: default from
 * skill sports on the FIRST render only, All exclusivity, All when no skill
 * sports, and the user's selection surviving re-renders and data reloads.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { act } from '../../test-utils/render';
import type { Resource } from '../useResource';
import { useSportFilter } from '../useSportFilter';
import type { SportFilter } from '../useSportFilter';
import type { Sport } from '../../types/sport';
import type { SkillLevel } from '../../types/user';

const SPORTS: Sport[] = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'football', display_name: 'Football', slug: 'football' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
];

interface Inputs {
  sports: Resource<Sport[]>;
  skills: SkillLevel[] | undefined;
  settled: boolean;
}

const sportsResource = (status: Resource<Sport[]>['status'], data?: Sport[]): Resource<Sport[]> => ({
  status,
  data,
  load: jest.fn(),
});

function setup(initial: Inputs) {
  const filter: { current: SportFilter | null } = { current: null };
  const inputs = { current: initial };
  function Probe(): React.JSX.Element {
    filter.current = useSportFilter(inputs.current.sports, inputs.current.skills, inputs.current.settled);
    return <></>;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const mount = async (): Promise<void> => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Probe />);
    });
  };
  /** Re-renders the SAME mounted hook with new inputs (same component instance). */
  const rerender = async (next: Inputs): Promise<void> => {
    inputs.current = next;
    await ReactTestRenderer.act(async () => {
      renderer.update(<Probe />);
    });
  };
  return { filter, mount, rerender };
}

describe('useSportFilter', () => {
  it('defaults to the skill sports that are in the admin list', async () => {
    const { filter, mount } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: [
        { sport: 'Tennis', skill_level: 'beginner' },
        { sport: 'rugby', skill_level: 'expert' },
      ],
      settled: true,
    });
    await mount();
    expect(filter.current?.selected).toEqual(['tennis']);
  });

  it('defaults to All when the user has no skill sports', async () => {
    const { filter, mount } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: [],
      settled: true,
    });
    await mount();
    expect(filter.current?.selected).toEqual([]);
  });

  it('defaults to All when the profile call failed (settled without data)', async () => {
    const { filter, mount } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: undefined,
      settled: true,
    });
    await mount();
    expect(filter.current?.selected).toEqual([]);
  });

  it('waits for both sources, then applies the default once', async () => {
    const { filter, mount, rerender } = setup({
      sports: sportsResource('loading'),
      skills: undefined,
      settled: false,
    });
    await mount();
    expect(filter.current?.isLoading).toBe(true);
    expect(filter.current?.selected).toEqual([]);

    await rerender({
      sports: sportsResource('ready', SPORTS),
      skills: [{ sport: 'football', skill_level: 'expert' }],
      settled: true,
    });
    expect(filter.current?.isLoading).toBe(false);
    expect(filter.current?.selected).toEqual(['football']);
  });

  it('toggles chips, keeps All exclusive, and re-selects All when every sport is cleared', async () => {
    const { filter, mount } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: [{ sport: 'tennis', skill_level: 'expert' }],
      settled: true,
    });
    await mount();
    expect(filter.current?.selected).toEqual(['tennis']);

    await act(async () => filter.current?.toggle('football'));
    expect(filter.current?.selected).toEqual(['tennis', 'football']);

    await act(async () => filter.current?.toggle(null));
    expect(filter.current?.selected).toEqual([]);

    await act(async () => filter.current?.toggle('badminton'));
    expect(filter.current?.selected).toEqual(['badminton']);

    await act(async () => filter.current?.toggle('badminton'));
    expect(filter.current?.selected).toEqual([]);
  });

  it("never overwrites the user's selection after a re-render or a data reload", async () => {
    const { filter, mount, rerender } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: [{ sport: 'tennis', skill_level: 'expert' }],
      settled: true,
    });
    await mount();
    await act(async () => filter.current?.toggle(null));
    await act(async () => filter.current?.toggle('football'));
    expect(filter.current?.selected).toEqual(['football']);

    // Plain re-render, then a reload delivering fresh sports/skill data.
    await rerender({
      sports: sportsResource('ready', SPORTS),
      skills: [{ sport: 'tennis', skill_level: 'expert' }],
      settled: true,
    });
    expect(filter.current?.selected).toEqual(['football']);
    await rerender({
      sports: sportsResource('ready', [...SPORTS]),
      skills: [{ sport: 'badminton', skill_level: 'beginner' }],
      settled: true,
    });
    expect(filter.current?.selected).toEqual(['football']);
  });

  it("lets a tap before the data settles win over the later default", async () => {
    const { filter, mount, rerender } = setup({
      sports: sportsResource('loading'),
      skills: undefined,
      settled: false,
    });
    await mount();
    await act(async () => filter.current?.toggle('tennis'));
    await rerender({
      sports: sportsResource('ready', SPORTS),
      skills: [{ sport: 'football', skill_level: 'expert' }],
      settled: true,
    });
    expect(filter.current?.selected).toEqual(['tennis']);
  });

  it('drops a selected sport that left the admin list without rewriting the choice', async () => {
    const { filter, mount, rerender } = setup({
      sports: sportsResource('ready', SPORTS),
      skills: [],
      settled: true,
    });
    await mount();
    await act(async () => filter.current?.toggle('tennis'));
    await rerender({
      sports: sportsResource('ready', SPORTS.filter(sport => sport.name !== 'tennis')),
      skills: [],
      settled: true,
    });
    expect(filter.current?.selected).toEqual([]);
    await rerender({ sports: sportsResource('ready', SPORTS), skills: [], settled: true });
    expect(filter.current?.selected).toEqual(['tennis']);
  });
});
