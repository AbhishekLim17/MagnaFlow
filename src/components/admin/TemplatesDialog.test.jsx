import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesDialog from './TemplatesDialog';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';

const mocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  getSubtasks: vi.fn(),
  createFromPlan: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/services/templateService', () => ({
  listTemplates: mocks.listTemplates, saveTemplate: mocks.saveTemplate, deleteTemplate: mocks.deleteTemplate,
}));
vi.mock('@/services/subtaskService', () => ({ getSubtasks: mocks.getSubtasks }));
vi.mock('@/contexts/TasksContext', () => ({ useTasks: () => ({ createFromPlan: mocks.createFromPlan }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const day = (iso) => new Date(`${iso}T00:00:00Z`);
const launch = {
  id: 'tpl1',
  name: 'Website launch',
  description: 'Our usual launch plan',
  createdBy: 'someone-else',
  items: [
    { key: 't1', title: 'Kick-off', priority: 'high', startOffset: 0, duration: 0, dependsOn: [], subtasks: [] },
    { key: 't2', title: 'Design', priority: 'medium', startOffset: 2, duration: 4, dependsOn: ['t1'], subtasks: ['Mobile'] },
  ],
};
const projects = [{ id: 'p1', name: 'Apollo', departmentId: 'd1' }];
const people = [{ id: 'u1', name: 'Sana Staff' }];
const tasks = [
  { id: 'a', title: 'Plan', projectId: 'p1', status: 'completed', startDate: day('2026-10-01'), deadline: day('2026-10-02'), blockedBy: [] },
  { id: 'b', title: 'Build', projectId: 'p1', status: 'pending', startDate: day('2026-10-03'), deadline: day('2026-10-09'), blockedBy: ['a'] },
  { id: 'c', title: 'Elsewhere', projectId: 'p2', status: 'pending', blockedBy: [] },
];

const setup = (user = { uid: 'me', role: 'manager', orgId: 'org1' }) => {
  render(
    <ConfirmProvider>
      <TemplatesDialog open onOpenChange={() => {}} currentUser={user} projects={projects} people={people} tasks={tasks} />
    </ConfirmProvider>
  );
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTemplates.mockResolvedValue([launch]);
  mocks.createFromPlan.mockResolvedValue({ created: [{}, {}], failed: [] });
  mocks.saveTemplate.mockResolvedValue('new');
  mocks.getSubtasks.mockImplementation(async (id) => (id === 'b' ? [{ title: 'Backend' }, { title: 'Frontend' }] : []));
});

describe('using a template', () => {
  test('lays the plan out from the chosen start date and creates it in the chosen project', async () => {
    const user = setup();
    await user.click(await screen.findByRole('radio', { name: /Website launch/ }));

    const start = screen.getByLabelText('Starts on');
    await user.clear(start);
    await user.type(start, '2026-11-02');

    const preview = screen.getByRole('table', { name: /will be created/i });
    expect(within(preview).getByRole('row', { name: /Kick-off/ })).toHaveTextContent('2 Nov 2026');
    expect(within(preview).getByRole('row', { name: /Design/ })).toHaveTextContent('4 Nov 2026');
    expect(within(preview).getByRole('row', { name: /Design/ })).toHaveTextContent('8 Nov 2026');

    await user.click(screen.getByRole('button', { name: 'Create 2 tasks' }));

    await waitFor(() => expect(mocks.createFromPlan).toHaveBeenCalled());
    const [plan, options] = mocks.createFromPlan.mock.calls[0];
    expect(plan.map((p) => p.task.title)).toEqual(['Kick-off', 'Design']);
    expect(plan[1]).toMatchObject({ dependsOn: ['t1'], subtasks: ['Mobile'] });
    expect(plan[1].task).toMatchObject({ projectId: 'p1', departmentId: 'd1', startDate: '2026-11-04', deadline: '2026-11-08', assignedTo: '' });
    expect(options.notify).toBe(false);
    expect(await screen.findByText('2 tasks created.')).toBeInTheDocument();
  });

  test('every task can be given to one person', async () => {
    const user = setup();
    await user.click(await screen.findByRole('radio', { name: /Website launch/ }));
    await user.click(screen.getByRole('combobox', { name: 'Assign every task to' }));
    await user.click(await screen.findByRole('option', { name: 'Sana Staff' }));
    await user.click(screen.getByRole('button', { name: 'Create 2 tasks' }));
    await waitFor(() => expect(mocks.createFromPlan.mock.calls[0][0].every((p) => p.task.assignedTo === 'u1')).toBe(true));
  });

  test('an empty organisation is told how to get started', async () => {
    mocks.listTemplates.mockResolvedValue([]);
    setup();
    expect(await screen.findByText(/No templates yet/)).toHaveTextContent(/Save a project/);
  });
});

describe('saving a template', () => {
  test('copies the project’s tasks with their checklists, and needs a name', async () => {
    const user = setup();
    await user.click(screen.getByRole('tab', { name: 'Save as template' }));
    await user.click(screen.getByRole('combobox', { name: 'Project to copy' }));
    await user.click(await screen.findByRole('option', { name: 'Apollo' }));
    expect(screen.getByText(/2 tasks over 9 days, 1 dependency/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByText('Give the template a name.')).toBeInTheDocument();
    expect(mocks.saveTemplate).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Template name'), 'Product launch');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(mocks.saveTemplate).toHaveBeenCalled());
    const [orgId, { name, items }, createdBy] = mocks.saveTemplate.mock.calls[0];
    expect([orgId, name, createdBy]).toEqual(['org1', 'Product launch', 'me']);
    expect(items.map((i) => i.title)).toEqual(['Plan', 'Build']);
    expect(items[1]).toMatchObject({ dependsOn: ['t1'], subtasks: ['Backend', 'Frontend'], startOffset: 2, duration: 6 });
  });

  test('staff can use templates but not save them', async () => {
    setup({ uid: 'me', role: 'staff', orgId: 'org1' });
    await screen.findByRole('radio', { name: /Website launch/ });
    expect(screen.queryByRole('tab', { name: 'Save as template' })).not.toBeInTheDocument();
  });
});

describe('deleting a template', () => {
  test('only the author or an org admin sees the delete button, and it asks first', async () => {
    setup();
    await screen.findByRole('radio', { name: /Website launch/ });
    expect(screen.queryByRole('button', { name: /Delete the Website launch template/ })).not.toBeInTheDocument();
  });

  test('an org admin can delete after confirming', async () => {
    const user = setup({ uid: 'admin', role: 'org-admin', orgId: 'org1' });
    await user.click(await screen.findByRole('button', { name: 'Delete the Website launch template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete template' }));
    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith('org1', 'tpl1'));
    expect(screen.queryByRole('radio', { name: /Website launch/ })).not.toBeInTheDocument();
  });
});
