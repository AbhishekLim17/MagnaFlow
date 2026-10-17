import { describe, expect, it } from 'vitest';
import { enabledFrom, featureOn, featureShown, isCore, toggled, visibleMenu } from './features';

describe('features', () => {
  it('keeps essentials on and starts everything else off', () => {
    expect(isCore('tasks')).toBe(true);
    expect(featureOn([], 'tasks')).toBe(true);
    expect(featureOn([], 'sprints')).toBe(false);
    expect(featureOn(['sprints'], 'sprints')).toBe(true);
    expect(featureOn([], undefined)).toBe(true); // a menu entry with no feature is essential
  });

  it('reads only known optional features from the settings document', () => {
    expect(enabledFrom({ enabled: ['sprints', 'tasks', 'made-up', 'goals'] })).toEqual(['sprints', 'goals']);
    expect(enabledFrom(null)).toEqual([]);
    expect(enabledFrom({ enabled: 'nope' })).toEqual([]);
  });

  it("lets a person hide optional features from their own menu, never essentials", () => {
    expect(featureShown(['goals'], ['goals'], 'goals')).toBe(false);
    expect(featureShown(['goals'], [], 'goals')).toBe(true);
    expect(featureShown([], ['tasks'], 'tasks')).toBe(true);
  });

  it('filters a dashboard menu', () => {
    const menu = [{ id: 'dashboard' }, { id: 'tasks' }, { id: 'sprints' }, { id: 'clients' }, { id: 'requests' }, { id: 'goals' }];
    expect(visibleMenu(menu, ['clientPortal', 'goals'], ['goals']).map((m) => m.id)).toEqual(['dashboard', 'tasks', 'clients', 'requests']);
  });

  it('adds and removes optional features only', () => {
    expect(toggled(['goals'], 'sprints', true)).toEqual(['goals', 'sprints']);
    expect(toggled(['goals', 'sprints'], 'goals', false)).toEqual(['sprints']);
    expect(toggled(['goals'], 'goals', true)).toEqual(['goals']);
    expect(toggled(['goals'], 'tasks', false)).toEqual(['goals']);
  });
});

describe('the feature catalogue', () => {
  it('describes every feature, in a known category, with an example', async () => {
    const { FEATURE_CATALOG, CATEGORIES } = await import('./featureCatalog');
    const { ALL_FEATURES } = await import('./features');
    expect(FEATURE_CATALOG.map((f) => f.id).sort()).toEqual([...ALL_FEATURES].sort());
    const complete = (f) => CATEGORIES.some((c) => c.id === f.category) && Boolean(f.summary && f.what && f.example && f.steps.length);
    expect(FEATURE_CATALOG.filter((f) => !complete(f)).map((f) => f.id)).toEqual([]);
  });
});
