import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { APP_URL, safeButtonLink, cleanEmailList, createTenantLookup } = require('./tenant.cjs');

// Minimal stand-in for the slice of the Admin SDK the lookup uses.
const fakeDb = ({ orgs = {}, tasks = {}, users = [] }) => ({
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        const store = name === 'organizations' ? orgs : tasks;
        return { exists: id in store, id, data: () => store[id] };
      },
    }),
    where: (_field, _op, value) => ({
      limit: () => ({
        get: async () => ({
          docs: users.filter((u) => u.email === value).map((u) => ({ data: () => u })),
        }),
      }),
    }),
  }),
});

describe('safeButtonLink', () => {
  test('keeps links back to the app', () => {
    expect(safeButtonLink(`${APP_URL}/staff`)).toBe(`${APP_URL}/staff`);
  });
  test('replaces anything else with the app URL', () => {
    expect(safeButtonLink('https://evil.example/login')).toBe(APP_URL);
    expect(safeButtonLink('javascript:alert(1)')).toBe(APP_URL);
    expect(safeButtonLink(undefined)).toBe(APP_URL);
  });
});

describe('cleanEmailList', () => {
  test('accepts arrays and comma strings, drops invalid entries', () => {
    expect(cleanEmailList(['a@x.com', ' b@x.com ', 'nope', ''])).toEqual(['a@x.com', 'b@x.com']);
    expect(cleanEmailList('a@x.com, b@x.com,bad')).toEqual(['a@x.com', 'b@x.com']);
    expect(cleanEmailList(null)).toEqual([]);
  });
});

describe('tenant lookup', () => {
  const db = fakeDb({
    orgs: { orgA: { ccEmails: ['boss@a.com', 'junk'] }, orgB: { ccEmails: 'boss@b.com' } },
    tasks: { t1: { orgId: 'orgA' } },
    users: [
      { email: 'staff@a.com', orgId: 'orgA', status: 'active' },
      { email: 'gone@a.com', orgId: 'orgA', status: 'inactive' },
      { email: 'staff@b.com', orgId: 'orgB', status: 'active' },
    ],
  });

  test('CC list comes from the organization, never another one', async () => {
    const t = createTenantLookup(db);
    expect(await t.ccFor('orgA')).toBe('boss@a.com');
    expect(await t.ccFor('orgB')).toBe('boss@b.com');
    expect(await t.ccFor('missing')).toBe('');
    expect(await t.ccFor(undefined)).toBe('');
  });

  test('recipient must be an active member of the same organization', async () => {
    const t = createTenantLookup(db);
    expect(await t.isActiveMemberOf('staff@a.com', 'orgA')).toBe(true);
    expect(await t.isActiveMemberOf('staff@b.com', 'orgA')).toBe(false);
    expect(await t.isActiveMemberOf('gone@a.com', 'orgA')).toBe(false);
    expect(await t.isActiveMemberOf('stranger@example.com', 'orgA')).toBe(false);
  });

  test('task lookup reports missing tasks as null', async () => {
    const t = createTenantLookup(db);
    expect((await t.getTask('t1')).orgId).toBe('orgA');
    expect(await t.getTask('nope')).toBeNull();
    expect(await t.getTask(undefined)).toBeNull();
  });
});
