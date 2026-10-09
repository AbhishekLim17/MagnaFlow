// Search and keyboard shortcuts, in every dashboard (DashboardLayout).
//   Ctrl/⌘ + K or /  open the search: pages of this dashboard and the tasks already loaded
//   N                new task (on dashboards with a task list)
//   ?                this list of shortcuts
// Choosing a task opens it where you are (?task=, see TaskDeepLink).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckSquare, CornerDownLeft, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/contexts/TasksContext';
import { searchEverything, typingInField } from '@/lib/search';
import { statusLabel } from '@/lib/taskLabels';
import { taskLink } from '@/lib/taskLink';

const SHORTCUTS = [
  ['Ctrl K', 'Search'],
  ['/', 'Search'],
  ['N', 'New task'],
  ['↑ ↓', 'Move through results'],
  ['Enter', 'Open'],
  ['?', 'Show shortcuts'],
];

const CommandPalette = ({ pages = [], onPage }) => {
  const { tasks = [] } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const canCreate = pages.some((p) => p.id === 'tasks');

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setOpen(true);
      } else if ((e.key === 'n' || e.key === 'N') && canCreate) {
        e.preventDefault();
        const base = location.pathname.split('/')[1];
        navigate(`/${base}/tasks?new=1`);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canCreate, location.pathname, navigate]);

  const results = useMemo(() => searchEverything(query, { pages, tasks }), [query, pages, tasks]);
  const items = useMemo(() => [
    ...results.pages.map((p) => ({ key: `p-${p.id}`, kind: 'page', page: p })),
    ...results.tasks.map((t) => ({ key: `t-${t.id}`, kind: 'task', task: t })),
  ], [results]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const close = (next) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const choose = (item) => {
    if (!item) return;
    close(false);
    if (item.kind === 'page') onPage?.(item.page.id);
    else navigate(taskLink(location.pathname, item.task.id));
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const optionId = (i) => `palette-option-${i}`;
  const showTasksHint = !query.trim();

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)">
        <Search className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Type to find a page or a task. Use the arrow keys and Enter to open one.</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder={tasks.length ? 'Search pages and tasks…' : 'Search pages…'}
              aria-label="Search pages and tasks"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant={items[active] ? optionId(active) : undefined}
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul id="palette-results" ref={listRef} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>
            )}
            {items.map((item, i) => {
              const Icon = item.kind === 'page' ? item.page.icon : CheckSquare;
              return (
                <li
                  key={item.key}
                  id={optionId(i)}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(item)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    i === active ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate">
                    {item.kind === 'page' ? item.page.label : item.task.title}
                  </span>
                  <span className={`shrink-0 text-xs ${i === active ? '' : 'text-muted-foreground'}`}>
                    {item.kind === 'page' ? 'Page' : statusLabel(item.task.status)}
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>

          {showTasksHint && (
            <div className="border-t border-border bg-muted/50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Keyboard shortcuts</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                {SHORTCUTS.filter(([k]) => canCreate || k !== 'N').map(([keys, what]) => (
                  <div key={keys + what} className="flex items-center gap-2">
                    <dt><kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">{keys}</kbd></dt>
                    <dd className="text-muted-foreground">{what}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CommandPalette;
