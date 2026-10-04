import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientRequests from './ClientRequests';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock('@/services/clientRequestService', () => ({
  listProjectRequests: mocks.list, createRequest: mocks.create, withdrawRequest: mocks.withdraw,
}));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const me = { uid: 'c1', name: 'Cleo Client' };
const itemWith = (text) => screen.getAllByRole('listitem').find((li) => within(li).queryByText(text));
const setup = () => {
  render(<ConfirmProvider><ClientRequests orgId="o1" projectId="p1" author={me} /></ConfirmProvider>);
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([
    { id: 'r1', title: 'Dark mode', status: 'declined', requestedBy: 'c1', requestedByName: 'Cleo Client', decidedByName: 'Mo', response: 'Next phase', createdAt: new Date('2026-10-01') },
    { id: 'r2', title: 'Export to PDF', status: 'new', requestedBy: 'c1', requestedByName: 'Cleo Client', createdAt: new Date('2026-10-02') },
  ]);
  mocks.create.mockImplementation(async (r) => ({ id: 'new', ...r, status: 'new', requestedBy: 'c1', requestedByName: 'Cleo Client', createdAt: new Date() }));
});

describe('ClientRequests', () => {
  test("lists the project's requests with what became of them", async () => {
    setup();
    expect(await screen.findByText('Export to PDF')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith('o1', 'p1');
    const declined = itemWith('Dark mode');
    expect(within(declined).getByText('Declined')).toBeInTheDocument();
    expect(declined).toHaveTextContent('Mo: Next phase');
  });

  test('sending a request needs a summary, then shows it as waiting', async () => {
    const user = setup();
    await screen.findByText('Export to PDF');
    await user.click(screen.getByRole('button', { name: 'New request' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText(/what you need/)).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('What do you need?'), 'A weekly summary email');
    await user.type(screen.getByLabelText('Details (optional)'), 'Every Monday');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'o1', projectId: 'p1', author: me, title: 'A weekly summary email', details: 'Every Monday', urgency: 'normal',
    })));
    expect(await screen.findByText('A weekly summary email')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/team has been told/);
  });

  test('a waiting request can be withdrawn after confirming; an answered one cannot', async () => {
    mocks.withdraw.mockResolvedValue();
    const user = setup();
    await screen.findByText('Export to PDF');
    expect(within(itemWith('Dark mode')).queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(mocks.withdraw).toHaveBeenCalledWith('r2'));
    expect(screen.queryByText('Export to PDF')).not.toBeInTheDocument();
  });
});
