import React, { useState } from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordField from './PasswordField';
import { passwordProblem } from '@/lib/password';

const Harness = ({ initial = '', ...props }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PasswordField id="pw" label="Password" value={value} onChange={setValue} {...props} />
      <output data-testid="value">{value}</output>
    </>
  );
};

const input = () => screen.getByLabelText(/^Password/);

afterEach(() => vi.restoreAllMocks());

describe('PasswordField', () => {
  test('hides what is typed until asked, and says so on the button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), 'hunter2hunter2');
    expect(input()).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('states the rule up front and rates what is typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

    await user.type(input(), 'abc');
    expect(screen.getByText('Too short')).toBeInTheDocument();

    await user.clear(input());
    await user.type(input(), 'Quiet-River-83');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  test('stops browsers filling in the admin\'s own password', () => {
    render(<Harness />);
    expect(input()).toHaveAttribute('autocomplete', 'new-password');
  });

  test('ties an error to the field so a screen reader hears it', () => {
    render(<Harness error="Use at least 8 characters (this has 3)." />);
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('this has 3');
    expect(input().getAttribute('aria-describedby')).toContain('pw-error');
  });

  test('offers Generate only when asked to', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
    unmount();
    render(<Harness generate />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  test('Generate fills in an acceptable password and shows it so it can be passed on', async () => {
    const user = userEvent.setup();
    render(<Harness generate />);
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /generate/i }));

    const generated = screen.getByTestId('value').textContent;
    expect(passwordProblem(generated)).toBeNull();
    expect(input()).toHaveAttribute('type', 'text');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  test('Copy puts the password on the clipboard and confirms', async () => {
    const user = userEvent.setup();
    render(<Harness generate />);
    // userEvent.setup() installs a clipboard stub; read it back from there.
    await user.click(screen.getByRole('button', { name: /generate/i }));
    const generated = screen.getByTestId('value').textContent;

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(generated);
  });

  test('if the clipboard is blocked the password is still visible to copy by hand', async () => {
    const user = userEvent.setup();
    render(<Harness generate initial="Quiet-River-83" />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input()).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(input()).toHaveAttribute('type', 'text'));
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });
});
