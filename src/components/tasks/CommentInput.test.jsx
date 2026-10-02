import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createComment = vi.fn();
vi.mock('../../services/commentService', () => ({ createComment: (...a) => createComment(...a) }));
const createNotificationsForMentions = vi.fn();
vi.mock('../../services/notificationService', () => ({
  createNotificationsForMentions: (...a) => createNotificationsForMentions(...a),
}));
const sendMentionEmail = vi.fn();
vi.mock('../../services/emailService', () => ({ sendMentionEmail: (...a) => sendMentionEmail(...a) }));
vi.mock('../../services/userService', () => ({ getAllUsers: vi.fn().mockRejectedValue(new Error('denied')) }));
const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));

const { default: CommentInput } = await import('./CommentInput');

const people = [
  { id: 'u2', name: 'Ann Lee', email: 'ann@x.co' },
  { id: 'u3', name: 'Annabel Cho', email: 'annabel@x.co' },
  { id: 'u4', name: 'Bo Zhang' },
];

const setup = () => {
  const user = userEvent.setup();
  render(<CommentInput taskId="t1" taskTitle="Ship it" userId="u1" userName="Me" userEmail="me@x.co" people={people} />);
  return { user, box: screen.getByRole('textbox') };
};

beforeEach(() => {
  vi.clearAllMocks();
  createComment.mockResolvedValue({ id: 'c1' });
  createNotificationsForMentions.mockResolvedValue([]);
  sendMentionEmail.mockResolvedValue({ success: true });
});

describe('mention typeahead', () => {
  test('a screen reader is told when the list opens, and how many people are in it', async () => {
    const { user, box } = setup();
    expect(screen.getByRole('status')).toHaveTextContent('');
    await user.type(box, '@ann');
    expect(screen.getByRole('status')).toHaveTextContent('2 people to mention');
    expect(box).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    await user.type(box, 'abel');
    expect(screen.getByRole('status')).toHaveTextContent('1 person to mention');
  });

  test('typing @ offers people, narrowing as you type', async () => {
    const { user, box } = setup();
    await user.type(box, 'hello @');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await user.type(box, 'ann');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Ann Lee'), expect.stringContaining('Annabel Cho'),
    ]);
  });

  test('arrow keys and Enter insert the chosen name as a mention', async () => {
    const { user, box } = setup();
    await user.type(box, 'ping @ann');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(box).toHaveValue('ping @AnnabelCho ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('clicking a suggestion works too', async () => {
    const { user, box } = setup();
    await user.type(box, '@bo');
    await user.click(screen.getByRole('option', { name: /Bo Zhang/ }));
    expect(box).toHaveValue('@BoZhang ');
  });

  test('Escape closes the list without inserting anything', async () => {
    const { user, box } = setup();
    await user.type(box, '@a');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box).toHaveValue('@a');
  });

  test('an email address does not open the list', async () => {
    const { user, box } = setup();
    await user.type(box, 'mail bob@ex');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('the highlighted option is announced to assistive tech', async () => {
    const { user, box } = setup();
    await user.type(box, '@');
    const first = screen.getAllByRole('option')[0];
    expect(box).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
  });
});

describe('posting', () => {
  test('Ctrl+Enter posts, notifies the mentioned person by uid, and clears the box', async () => {
    const { user, box } = setup();
    await user.type(box, 'thanks @AnnLee');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(createComment).toHaveBeenCalled());
    expect(createComment.mock.calls[0][5]).toEqual(['u2']);
    await waitFor(() => expect(sendMentionEmail).toHaveBeenCalledWith(expect.objectContaining({ toUid: 'u2', taskId: 't1' })));
    expect(createNotificationsForMentions.mock.calls[0][5]).toMatchObject({ taskTitle: 'Ship it' });
    await waitFor(() => expect(box).toHaveValue(''));
  });

  test('an empty comment says so and keeps the cursor in the box', async () => {
    const { user, box } = setup();
    await user.type(box, '   ');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/write something/i);
    expect(createComment).not.toHaveBeenCalled();
    expect(box).toHaveFocus();
  });

  test('if notifying fails the comment still stands, and the person is told', async () => {
    createNotificationsForMentions.mockRejectedValue(new Error('nope'));
    const { user, box } = setup();
    await user.type(box, 'hi @AnnLee');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Comment posted' })));
    await waitFor(() => expect(box).toHaveValue(''));
  });

  test('a failed post keeps the text and shows why', async () => {
    createComment.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const { user, box } = setup();
    await user.type(box, 'hello');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission/i);
    expect(box).toHaveValue('hello');
  });
});
