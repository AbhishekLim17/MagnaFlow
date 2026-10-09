import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { plusKey, authenticated, cleanBody, mayCreateIn, taskFrom, taskIdFor } = require('./inbound.cjs');

describe('plusKey', () => {
  const box = 'magna.flow@gmail.com';
  it("finds the project key in a plus address of the app's mailbox", () => {
    expect(plusKey(['someone@x.com', 'MagnaFlow+abcdef123456@gmail.com'], box)).toBe('abcdef123456');
    expect(plusKey(['magna.flow+abcdef123456@googlemail.com'], 'magnaflow@googlemail.com')).toBe('abcdef123456');
  });
  it('ignores other mailboxes, bare addresses and short keys', () => {
    expect(plusKey(['other+abcdef123456@gmail.com'], box)).toBeNull();
    expect(plusKey(['magnaflow@gmail.com'], box)).toBeNull();
    expect(plusKey(['magnaflow+short@gmail.com'], box)).toBeNull();
    expect(plusKey(['magnaflow+abcdef123456@evil.com'], box)).toBeNull();
  });
});

describe('authenticated', () => {
  it('needs SPF or DKIM to pass, and DMARC not to fail', () => {
    expect(authenticated('mx.google.com; dkim=pass header.i=@x.com; spf=pass')).toBe(true);
    expect(authenticated(['mx.google.com; spf=pass smtp.mailfrom=x.com'])).toBe(true);
    expect(authenticated('mx.google.com; spf=fail; dkim=none')).toBe(false);
    expect(authenticated('dkim=pass; dmarc=fail')).toBe(false);
    expect(authenticated(undefined)).toBe(false);
  });
});

describe('cleanBody', () => {
  it('keeps the new text and drops quoted replies and the signature', () => {
    const text = 'Please fix the login page.\nIt fails on Safari.\n\nOn Mon, 5 Oct 2026, Ann wrote:\n> old stuff';
    expect(cleanBody(text)).toBe('Please fix the login page.\nIt fails on Safari.');
    expect(cleanBody('Hello\n-- \nSent from my phone')).toBe('Hello');
    expect(cleanBody('a\n> quoted\nb')).toBe('a\nb');
    expect(cleanBody('x'.repeat(20), 10)).toHaveLength(10);
  });
});

describe('who may', () => {
  const project = { id: 'p1', departmentId: 'd1' };
  it('mirrors the task create rule', () => {
    expect(mayCreateIn({ orgId: 'o', role: 'org-admin' }, project, 'o')).toBe(true);
    expect(mayCreateIn({ orgId: 'o', role: 'staff', projectIds: ['p1'] }, project, 'o')).toBe(true);
    expect(mayCreateIn({ orgId: 'o', role: 'department-head', departmentIds: ['d1'] }, project, 'o')).toBe(true);
    expect(mayCreateIn({ orgId: 'o', role: 'staff', projectIds: ['p2'] }, project, 'o')).toBe(false);
    expect(mayCreateIn({ orgId: 'o', role: 'client', projectIds: ['p1'] }, project, 'o')).toBe(false);
    expect(mayCreateIn({ orgId: 'o', role: 'org-admin', status: 'inactive' }, project, 'o')).toBe(false);
    expect(mayCreateIn({ orgId: 'x', role: 'org-admin' }, project, 'o')).toBe(false);
  });
});

describe('the task', () => {
  it('takes the subject (without Fwd:) and the cleaned body, for the sender', () => {
    const t = taskFrom({ subject: 'Fwd: Broken invoice PDF', text: 'See below\nOn x wrote:\n> y' }, { id: 'u1' }, { id: 'p1', departmentId: 'd1' }, 'o', 'NOW');
    expect(t).toMatchObject({ title: 'Broken invoice PDF', description: 'See below', assignedTo: 'u1', createdBy: 'u1', projectId: 'p1', departmentId: 'd1', source: 'email' });
    expect(taskFrom({ subject: '' }, { id: 'u' }, { id: 'p' }, 'o', 'NOW').title).toBe('(no subject)');
  });
  it('has a stable id per message', () => {
    expect(taskIdFor({ messageId: '<a@b>' })).toBe(taskIdFor({ messageId: '<a@b>' }));
    expect(taskIdFor({ messageId: '<a@b>' })).not.toBe(taskIdFor({ messageId: '<c@d>' }));
  });
});
