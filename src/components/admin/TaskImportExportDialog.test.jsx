import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskImportExportDialog from './TaskImportExportDialog';

const mocks = vi.hoisted(() => ({ importTasks: vi.fn(), downloadText: vi.fn(), downloadWorkbook: vi.fn() }));
vi.mock('@/contexts/TasksContext', () => ({ useTasks: () => ({ importTasks: mocks.importTasks }) }));
vi.mock('@/lib/csv', async (importOriginal) => ({ ...(await importOriginal()), downloadText: mocks.downloadText }));
vi.mock('@/lib/workspaceExport', async (importOriginal) => ({ ...(await importOriginal()), downloadWorkbook: mocks.downloadWorkbook }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const people = [{ id: 'u1', name: 'Sana Staff', email: 'sana@demo.test' }];
const projects = [{ id: 'p1', name: 'Apollo', departmentId: 'd1' }];
const lookups = { person: (uid) => people.find((p) => p.id === uid), projectName: (id) => projects.find((p) => p.id === id)?.name };
const tasks = [
  { id: 't1', title: 'Write the spec', status: 'pending', priority: 'high', assignedTo: 'u1', blockedBy: [] },
  { id: 't2', title: 'Ship it', status: 'completed', priority: 'low', blockedBy: [] },
];

const setup = (props = {}) => {
  const onOpenChange = vi.fn();
  render(
    <TaskImportExportDialog
      open
      onOpenChange={onOpenChange}
      people={people}
      projects={projects}
      visibleTasks={tasks.slice(0, 1)}
      allTasks={tasks}
      filtered
      lookups={lookups}
      {...props}
    />
  );
  return { onOpenChange, user: userEvent.setup() };
};

const csvFile = (text, name = 'tasks.csv') => new File([text], name, { type: 'text/csv' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importTasks.mockImplementation(async (list, { onProgress }) => {
    list.forEach((_, i) => onProgress?.(i + 1, list.length));
    return { created: list.map((t, i) => ({ id: `n${i}`, ...t })), failed: [] };
  });
});

describe('import', () => {
  test('previews what will happen, lists problems by line, and imports only the good rows', async () => {
    const { user } = setup();
    await user.upload(
      screen.getByLabelText('Spreadsheet (CSV)'),
      csvFile('Title,Assignee,Deadline,Project\nWrite docs,Sana Staff,05/10/2026,Apollo\n,Sana Staff,,\nPlan,Nobody,,Apollo\n'),
    );

    expect(await screen.findByText('1 task ready')).toBeInTheDocument();
    expect(screen.getByText('2 rows with problems (skipped)')).toBeInTheDocument();
    expect(screen.getByText('Line 3:')).toBeInTheDocument();
    expect(screen.getByText('Title is empty.')).toBeInTheDocument();
    expect(screen.getByText(/No one in your team is called “Nobody”/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /first tasks that will be created/i })).toHaveTextContent('Write docs');

    await user.click(screen.getByRole('button', { name: 'Import 1 task' }));

    await waitFor(() => expect(mocks.importTasks).toHaveBeenCalledTimes(1));
    const [list, options] = mocks.importTasks.mock.calls[0];
    expect(list).toEqual([expect.objectContaining({ title: 'Write docs', assignedTo: 'u1', deadline: '2026-10-05', projectId: 'p1' })]);
    expect(options.notify).toBe(false);
    expect(await screen.findByText('1 task imported.')).toBeInTheDocument();
  });

  test('emails are off unless asked for', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('checkbox', { name: /email the assignees/i }));
    await user.upload(screen.getByLabelText('Spreadsheet (CSV)'), csvFile('Title\nOne\n'));
    await user.click(await screen.findByRole('button', { name: 'Import 1 task' }));
    await waitFor(() => expect(mocks.importTasks.mock.calls[0][1].notify).toBe(true));
    expect(await screen.findByText(/get an email within about 15 minutes/)).toBeInTheDocument();
  });

  test('rows the server refused are reported against their spreadsheet line', async () => {
    mocks.importTasks.mockResolvedValue({
      created: [{ id: 'n0' }],
      failed: [{ index: 1, task: { title: 'Two' }, message: 'You do not have permission.' }],
    });
    const { user } = setup();
    await user.upload(screen.getByLabelText('Spreadsheet (CSV)'), csvFile('Title\nOne\nTwo\n'));
    await user.click(await screen.findByRole('button', { name: 'Import 2 tasks' }));

    expect(await screen.findByText('1 task imported.')).toBeInTheDocument();
    expect(screen.getByText('1 row could not be created')).toBeInTheDocument();
    expect(screen.getByText('Line 3:')).toBeInTheDocument();
    expect(screen.getByText('Two: You do not have permission.')).toBeInTheDocument();
  });

  test('a file that cannot be used says why, and nothing can be imported', async () => {
    const { user } = setup();
    await user.upload(screen.getByLabelText('Spreadsheet (CSV)'), csvFile('Foo,Bar\n1,2\n'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no Title column/);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  test('the date order can be switched to month first', async () => {
    const { user } = setup();
    await user.upload(screen.getByLabelText('Spreadsheet (CSV)'), csvFile('Title,Deadline\nOne,10/05/2026\n'));
    await screen.findByText('1 task ready');
    await user.click(screen.getByRole('combobox', { name: /dates like/i }));
    await user.click(await screen.findByRole('option', { name: /month first/i }));
    await user.click(screen.getByRole('button', { name: 'Import 1 task' }));
    await waitFor(() => expect(mocks.importTasks.mock.calls[0][0][0].deadline).toBe('2026-10-05'));
  });

  test('a sample file can be downloaded', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Download a sample file' }));
    expect(mocks.downloadText).toHaveBeenCalledWith(expect.stringContaining('Title,Description'), 'MagnaFlow task import sample.csv');
  });
});

describe('export', () => {
  test('the filtered list and the whole list export as CSV', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: /export/i }));
    expect(screen.getByText(/The 1 task matching your filters/)).toBeInTheDocument();

    const [filteredButton, allButton] = screen.getAllByRole('button', { name: /export csv/i });
    await user.click(filteredButton);
    expect(mocks.downloadText.mock.calls[0][0]).toContain('Write the spec');
    expect(mocks.downloadText.mock.calls[0][0]).not.toContain('Ship it');
    expect(mocks.downloadText.mock.calls[0][1]).toMatch(/^MagnaFlow tasks \(filtered\) \d{4}-\d{2}-\d{2}\.csv$/);

    await user.click(allButton);
    expect(mocks.downloadText.mock.calls[1][0]).toContain('Ship it');
  });

  test('the whole-workspace export is only offered when allowed, and builds every sheet', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: /export/i }));
    expect(screen.queryByText('Whole workspace')).not.toBeInTheDocument();
  });

  test('org admins get a workbook with the workspace in it', async () => {
    const loadWorkspace = vi.fn().mockResolvedValue({
      people, projects, departments: [{ id: 'd1', name: 'Engineering' }], designations: [], organisation: 'Magnetar', exportedBy: 'Arjun',
    });
    const { user } = setup({ loadWorkspace });
    await user.click(screen.getByRole('tab', { name: /export/i }));
    await user.click(screen.getByRole('button', { name: /export excel/i }));

    await waitFor(() => expect(mocks.downloadWorkbook).toHaveBeenCalled());
    const [sheets, filename] = mocks.downloadWorkbook.mock.calls[0];
    expect(sheets.map((s) => s.name)).toEqual(['About', 'Tasks', 'People', 'Projects', 'Departments', 'Designations']);
    expect(sheets[1].rows).toHaveLength(3); // header + both tasks
    expect(filename).toMatch(/^Magnetar workspace \d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
