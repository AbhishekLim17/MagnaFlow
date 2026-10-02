// KanbanBoard.jsx � Full Kanban board with 4 columns and drag-and-drop
// Reusable across Admin Task Management and Staff Dashboard.
// Columns: Todo (pending) | In Progress (in-progress) | Review (review) | Done (completed)

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimation,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanCard from '@/components/shared/KanbanCard';

// -----------------------------------------------------------------------------
// Column configuration
// -----------------------------------------------------------------------------
const COLUMNS = [
  {
    id: 'pending',
    label: 'Todo',
    colorClass: 'from-slate-500/20 to-slate-400/10',
    headerClass: 'text-muted-foreground',
    dotClass: 'bg-slate-400',
    countClass: 'bg-muted text-muted-foreground',
    borderClass: 'border-slate-200/50 dark:border-slate-700/50',
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    colorClass: 'from-blue-500/20 to-blue-400/10',
    headerClass: 'text-primary',
    dotClass: 'bg-blue-500',
    countClass: 'bg-primary-soft text-primary',
    borderClass: 'border-blue-200/50 dark:border-blue-900/50',
  },
  {
    id: 'review',
    label: 'Review',
    colorClass: 'from-amber-500/20 to-amber-400/10',
    headerClass: 'text-warning',
    dotClass: 'bg-amber-500',
    countClass: 'bg-warning-soft text-warning',
    borderClass: 'border-amber-200/50 dark:border-amber-900/50',
  },
  {
    id: 'completed',
    label: 'Done',
    colorClass: 'from-emerald-500/20 to-emerald-400/10',
    headerClass: 'text-success',
    dotClass: 'bg-emerald-500',
    countClass: 'bg-success-soft text-success',
    borderClass: 'border-emerald-200/50 dark:border-emerald-900/50',
  },
];

// -----------------------------------------------------------------------------
// Column component
// -----------------------------------------------------------------------------
const KanbanColumn = ({ column, tasks, staffMap, onCardClick, onAddTask, canAdd }) => {
  const taskIds = tasks.map((t) => t.id);
  // Fix #1: column is its own droppable target so empty columns accept card drops
  const { setNodeRef: setColRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setColRef}
      className={`flex flex-col rounded-2xl border bg-gradient-to-b ${column.colorClass} ${column.borderClass} min-w-[82vw] snap-start sm:min-w-[280px] sm:max-w-[320px] flex-1 transition-colors duration-150 ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.dotClass}`} />
          <h2 className={`font-semibold text-sm ${column.headerClass}`}>{column.label}</h2>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${column.countClass}`}>
            {tasks.length}
          </span>
        </div>
        {canAdd && (
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/20 sm:h-8 sm:w-8"
            onClick={() => onAddTask?.(column.id)}
            title={`Add task to ${column.label}`}
            aria-label={`Add task to ${column.label}`}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px] max-h-[60vh] sm:max-h-[calc(100vh-280px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {tasks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground/50">No tasks here</p>
              </motion.div>
            ) : (
              tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <KanbanCard
                    task={task}
                    staffMap={staffMap}
                    onCardClick={onCardClick}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main KanbanBoard
// -----------------------------------------------------------------------------
/**
 * @param {Object[]} props.tasks          - All task objects already filtered by parent
 * @param {Object}   props.staffMap       - { [userId]: name }
 * @param {Function} props.onStatusChange - async (taskId, newStatus) => void
 * @param {Function} props.onCardClick    - (task) => void � open task details
 * @param {Function} props.onAddTask      - (defaultStatus) => void � open add dialog (admin only)
 * @param {boolean}  props.canAdd         - Whether to show + button per column (admin)
 */
const KanbanBoard = ({ tasks = [], staffMap = {}, onStatusChange, onCardClick, onAddTask, canAdd = false }) => {
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group tasks into columns
  const grouped = useMemo(() => {
    const map = {};
    COLUMNS.forEach((c) => { map[c.id] = []; });
    tasks.forEach((t) => {
      // Cancelled work is not part of the flow; it used to fall through to Todo and
      // look like something still to do. It is counted and mentioned below instead.
      if (t.status === 'cancelled') return;
      const col = COLUMNS.find((c) => c.id === t.status);
      if (col) {
        map[col.id].push(t);
      } else {
        // unknown status ? put in Todo
        map['pending'].push(t);
      }
    });
    return map;
  }, [tasks]);

  const cancelledCount = useMemo(() => tasks.filter((t) => t.status === 'cancelled').length, [tasks]);

  // Find which column a task belongs to
  const findColumnOfTask = (taskId) => {
    for (const col of COLUMNS) {
      if (grouped[col.id]?.some((t) => t.id === taskId)) return col.id;
    }
    return null;
  };

  const handleDragStart = ({ active }) => {
    const found = tasks.find((t) => t.id === active.id);
    setActiveTask(found || null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const fromCol = findColumnOfTask(active.id);

    // over.id can be either a task id or a column id
    let toCol = COLUMNS.find((c) => c.id === over.id)?.id;
    if (!toCol) {
      toCol = findColumnOfTask(over.id);
    }

    if (!toCol || fromCol === toCol) return;

    try {
      await onStatusChange?.(active.id, toCol);
    } catch (e) {
      console.error('Kanban status update failed:', e);
    }
  };

  // Screen readers get what a sighted user sees: which task, which column. The defaults
  // announce raw ids ("Draggable item 4f2a9c... was dropped over droppable area review").
  const titleOf = (id) => tasks.find((t) => t.id === id)?.title || 'the task';
  const columnNameOf = (overId) => {
    const colId = COLUMNS.some((c) => c.id === overId) ? overId : findColumnOfTask(overId);
    return COLUMNS.find((c) => c.id === colId)?.label || 'the board';
  };
  const accessibility = {
    announcements: {
      onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}, currently in ${columnNameOf(active.id)}.`,
      onDragOver: ({ active, over }) => (over
        ? `${titleOf(active.id)} is over ${columnNameOf(over.id)}.`
        : `${titleOf(active.id)} is not over a column.`),
      onDragEnd: ({ active, over }) => (over
        ? `${titleOf(active.id)} was dropped in ${columnNameOf(over.id)}.`
        : `${titleOf(active.id)} was put back where it was.`),
      onDragCancel: ({ active }) => `Move cancelled. ${titleOf(active.id)} stays in ${columnNameOf(active.id)}.`,
    },
    screenReaderInstructions: {
      draggable:
        'To move a task, press space or enter on its move button, use the arrow keys to choose another column, then press space or enter to drop it. Press escape to cancel.',
    },
  };

  const dropAnimation = {
    ...defaultDropAnimation,
    dragSourceOpacity: 0.5,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={accessibility}
    >
      {cancelledCount > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          {cancelledCount} cancelled task{cancelledCount > 1 ? 's are' : ' is'} hidden from the board.
        </p>
      )}
      {/* Horizontal scrollable board */}
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 px-0.5 -mx-0.5 sm:snap-none">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={grouped[col.id] || []}
            staffMap={staffMap}
            onCardClick={onCardClick}
            onAddTask={onAddTask}
            canAdd={canAdd}
          />
        ))}
      </div>

      {/* Drag overlay � floating clone while dragging */}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            staffMap={staffMap}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
