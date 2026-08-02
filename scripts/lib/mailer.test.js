import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { renderHtml, renderText, escapeHtml } = require('./mailer.cjs');

const base = {
  to_email: 'someone@example.com',
  notification_type: 'Task Assignment',
  title: 'Ship the billing job',
  message: 'You have been assigned a new task',
  detail_1_label: 'Task',
  detail_1_value: 'Ship the billing job',
  detail_2_label: 'Priority',
  detail_2_value: 'Critical',
  button_text: 'View Task',
  button_link: 'https://magnaflow-07sep25.web.app',
  footer_text: 'Log in to see the full task.',
};

describe('email rendering', () => {
  test('includes the title, message and details', () => {
    const html = renderHtml(base);
    expect(html).toContain('Ship the billing job');
    expect(html).toContain('You have been assigned a new task');
    expect(html).toContain('Priority');
    expect(html).toContain('Critical');
  });

  test('omits detail rows that have no label', () => {
    const html = renderHtml({ ...base, detail_3_label: '', detail_3_value: 'orphan value' });
    expect(html).not.toContain('orphan value');
  });

  // Task titles and descriptions are written by users and land in email HTML.
  // Without escaping, a title could inject markup into everyone's inbox.
  test('escapes markup in user-supplied values', () => {
    const html = renderHtml({
      ...base,
      title: '<script>alert(1)</script>',
      detail_1_value: '"><img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  // notification_color is interpolated into a style attribute, so anything that
  // is not a plain hex colour must not reach it.
  test('rejects a notification_color that is not a hex colour', () => {
    const html = renderHtml({ ...base, notification_color: 'red;} body{display:none' });
    expect(html).not.toContain('display:none');
    expect(html).toContain('#3e30d9');
  });

  test('accepts a valid hex colour', () => {
    expect(renderHtml({ ...base, notification_color: '#51b206' })).toContain('#51b206');
  });

  test('drops the button when there is no link', () => {
    const html = renderHtml({ ...base, button_link: '' });
    expect(html).not.toContain('View Task');
  });

  test('renders a plain-text alternative', () => {
    const text = renderText(base);
    expect(text).toContain('Ship the billing job');
    expect(text).toContain('Priority: Critical');
    expect(text).not.toContain('<');
  });

  test('escapeHtml handles the five significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  test('tolerates missing fields', () => {
    expect(() => renderHtml({})).not.toThrow();
    expect(() => renderText({})).not.toThrow();
  });
});
