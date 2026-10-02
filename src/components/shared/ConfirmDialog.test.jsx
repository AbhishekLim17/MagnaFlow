import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './ConfirmDialog';

const Harness = ({ options, onAnswer }) => {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onAnswer(await confirm(options))}>
      ask
    </button>
  );
};

const setup = (options = {}) => {
  const answers = [];
  render(
    <ConfirmProvider>
      <Harness options={options} onAnswer={(a) => answers.push(a)} />
    </ConfirmProvider>
  );
  return answers;
};

describe('useConfirm', () => {
  test('shows the wording it is given and resolves true on confirm', async () => {
    const user = userEvent.setup();
    const answers = setup({ title: 'Delete this task?', description: <p>It cannot be undone.</p>, confirmLabel: 'Delete', destructive: true });
    await user.click(screen.getByRole('button', { name: 'ask' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this task?')).toBeInTheDocument();
    expect(screen.getByText('It cannot be undone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(answers).toEqual([true]));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  test('resolves false on cancel', async () => {
    const user = userEvent.setup();
    const answers = setup({ title: 'Remove Sana?' });
    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(answers).toEqual([false]));
  });

  test('Escape counts as no', async () => {
    const user = userEvent.setup();
    const answers = setup({ title: 'Remove Sana?' });
    await user.click(screen.getByRole('button', { name: 'ask' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(answers).toEqual([false]));
  });

  test('asking again can be answered independently', async () => {
    const user = userEvent.setup();
    const answers = setup({ title: 'Again?', confirmLabel: 'Yes' });
    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(answers).toEqual([true, false]));
  });

  test('using it outside the provider is a clear error', () => {
    const Broken = () => { useConfirm(); return null; };
    expect(() => render(<Broken />)).toThrow(/ConfirmProvider/);
  });
});
