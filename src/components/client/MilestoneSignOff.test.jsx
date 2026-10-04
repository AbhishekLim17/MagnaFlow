import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MilestoneSignOff from './MilestoneSignOff';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';

const milestone = (extra = {}) => ({ id: 'm1', title: 'Design sign-off', milestone: true, status: 'review', ...extra });
const setup = (task, onDecide = vi.fn(async () => {})) => {
  render(<ConfirmProvider><MilestoneSignOff task={task} onDecide={onDecide} /></ConfirmProvider>);
  return { user: userEvent.setup(), onDecide };
};

describe('MilestoneSignOff', () => {
  test('nothing to do before the team puts the milestone up for review', () => {
    const { container } = render(<ConfirmProvider><MilestoneSignOff task={milestone({ status: 'in-progress' })} onDecide={vi.fn()} /></ConfirmProvider>);
    expect(container).toBeEmptyDOMElement();
  });

  test('approving asks for confirmation first', async () => {
    const { user, onDecide } = setup(milestone());
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Approve “Design sign-off”?');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), 'approved', ''));
  });

  test('asking for changes needs a note', async () => {
    const { user, onDecide } = setup(milestone({ status: 'completed' }));
    await user.click(screen.getByRole('button', { name: 'Request changes' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText(/Say what needs to change/)).toBeInTheDocument();
    expect(onDecide).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('What needs to change?'), 'Bigger logo, please');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(expect.anything(), 'changes_requested', 'Bigger logo, please'));
  });

  test('a decision is shown, and can be changed', async () => {
    const { user } = setup(milestone({ clientApproval: { decision: 'approved', byName: 'Cleo', at: new Date('2026-10-04T10:00:00Z') } }));
    expect(screen.getByText(/Approved by Cleo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change your decision' }));
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeInTheDocument();
  });

  test('a failed decision says so and keeps the note', async () => {
    const { user } = setup(milestone(), vi.fn(async () => { throw new Error('offline'); }));
    await user.click(screen.getByRole('button', { name: 'Request changes' }));
    await user.type(screen.getByLabelText('What needs to change?'), 'Fix the date');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/Couldn't send your decision/)).toBeInTheDocument();
    expect(screen.getByLabelText('What needs to change?')).toHaveValue('Fix the date');
  });
});
