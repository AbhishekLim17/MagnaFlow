import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { APP_URL, safeButtonLink, cleanEmailList, createTenantLookup } = require('./tenant.cjs');

// Minimal stand-in for the slice of the Admin SDK the lookup uses.
const fakeDb = ({ orgs = {}, tasks = {}, users = {}, settings = {} }) => ({
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        const store = { organizations: orgs, tasks, users }[name] || {};
        return { exists: id in store, id, data: () => store[id] };
      },
      collection: (sub) => ({
        doc: (subId) => ({
          get: async () => {
            const key = `${name}/${id}/${sub}/${subId}`;
            return { exists: key in settings, data: () => settings[key] };
          },
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
    orgs: { orgA: { ccEmails: ['boss@a.com', 'junk'] }, orgB: { ccEmails: 'boss@b.com' }, orgC: {} },
    settings: { 'organizations/orgC/private/settings': { ccEmails: ['private@c.com'] } },
    tasks: { t1: { orgId: 'orgA' } },
    users: {
      uA: { email: 'staff@a.com', name: 'Ann', orgId: 'orgA', status: 'active' },
      uGone: { email: 'gone@a.com', orgId: 'orgA', status: 'inactive' },
      uB: { email: 'staff@b.com', orgId: 'orgB', status: 'active' },
      uNoMail: { orgId: 'orgA', status: 'active' },
      uBad: { email: 'not-an-address', orgId: 'orgA' },
    },
  });

  test('CC list comes from the organization, never another one', async () => {
    const t = createTenantLookup(db);
    expect(await t.ccFor('orgA')).toBe('boss@a.com');
    expect(await t.ccFor('orgB')).toBe('boss@b.com');
    expect(await t.ccFor('missing')).toBe('');
    expect(await t.ccFor(undefined)).toBe('');
  });

  test('CC list prefers the private settings document over the public one', async () => {
    const t = createTenantLookup(db);
    expect(await t.ccFor('orgC')).toBe('private@c.com');
  });

  test('a recipient is resolved by uid, with the address taken from the user record', async () => {
    const t = createTenantLookup(db);
    // prefs: their email settings (none saved here), which the drain job honours
    expect(await t.resolveRecipient('uA', 'orgA')).toEqual({ email: 'staff@a.com', name: 'Ann', prefs: null });
  });

  test('a recipient outside the organization, deactivated, unknown or without a valid address is refused', async () => {
    const t = createTenantLookup(db);
    expect(await t.resolveRecipient('uB', 'orgA')).toBeNull();
    expect(await t.resolveRecipient('uGone', 'orgA')).toBeNull();
    expect(await t.resolveRecipient('nobody', 'orgA')).toBeNull();
    expect(await t.resolveRecipient('uNoMail', 'orgA')).toBeNull();
    expect(await t.resolveRecipient('uBad', 'orgA')).toBeNull();
    expect(await t.resolveRecipient(undefined, 'orgA')).toBeNull();
  });

  test('task lookup reports missing tasks as null', async () => {
    const t = createTenantLookup(db);
    expect((await t.getTask('t1')).orgId).toBe('orgA');
    expect(await t.getTask('nope')).toBeNull();
    expect(await t.getTask(undefined)).toBeNull();
  });
});
