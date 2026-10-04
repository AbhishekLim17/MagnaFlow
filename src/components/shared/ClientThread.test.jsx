import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientThread from './ClientThread';

const messages = [
  { id: 'a', authorName: 'Mo Manager', fromClient: false, kind: 'message', text: 'Draft is ready', createdAt: new Date('2026-10-01T10:00:00Z') },
  { id: 'b', authorName: 'Cleo Client', fromClient: true, kind: 'changes_requested', text: 'Bigger logo', createdAt: new Date('2026-10-02T10:00:00Z') },
  { id: 'c', authorName: 'Cleo Client', fromClient: true, kind: 'message', text: 'Thanks', createdAt: null },
];

describe('ClientThread', () => {
  test('shows who wrote what, which side they are on, and decisions', () => {
    render(<ClientThread messages={messages} viewerIsClient emptyText="none" />);
    const items = within(screen.getByRole('list', { name: /messages/i })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Mo Manager');
    expect(items[0]).toHaveTextContent('Project team');
    expect(items[1]).toHaveTextContent('Asked for changes');
    expect(items[1]).toHaveTextContent('Bigger logo');
    expect(items[2]).toHaveTextContent('sending…');
  });

  test('says when there is nothing yet; read-only without onSend', () => {
    render(<ClientThread messages={[]} emptyText="No messages yet." />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });

  test('sends a trimmed message and clears the box; refuses an empty one', async () => {
    const onSend = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ClientThread messages={[]} onSend={onSend} composeLabel="Write to the project team" emptyText="" />);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Write a message first.')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Write to the project team'), '  When is the launch?  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('When is the launch?'));
    expect(screen.getByLabelText('Write to the project team')).toHaveValue('');
  });

  test('a failed send keeps the text and says so', async () => {
    const user = userEvent.setup();
    render(<ClientThread messages={[]} onSend={vi.fn(async () => { throw new Error('x'); })} composeLabel="Message the client" emptyText="" />);
    await user.type(screen.getByLabelText('Message the client'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Couldn't send that/)).toBeInTheDocument();
    expect(screen.getByLabelText('Message the client')).toHaveValue('Hello');
  });
});
