// KanbanBoard.jsx — Full Kanban board with 4 columns and drag-and-drop
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
    headerClass: 'text-slate-500',
    dotClass: 'bg-slate-400',
    countClass: 'bg-slate-500/20 text-slate-500',
    borderClass: 'border-slate-200/50 dark:border-slate-700/50',
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    colorClass: 'from-blue-500/20 to-blue-400/10',
    headerClass: 'text-blue-500',
    dotClass: 'bg-blue-500',
    countClass: 'bg-blue-500/20 text-blue-600',
    borderClass: 'border-blue-200/50 dark:border-blue-900/50',
  },
  {
    id: 'review',
    label: 'Review',
    colorClass: 'from-amber-500/20 to-amber-400/10',
    headerClass: 'text-amber-500',
    dotClass: 'bg-amber-500',
    countClass: 'bg-amber-500/20 text-amber-600',
    borderClass: 'border-amber-200/50 dark:border-amber-900/50',
  },
  {
    id: 'completed',
    label: 'Done',
    colorClass: 'from-emerald-500/20 to-emerald-400/10',
    headerClass: 'text-emerald-500',
    dotClass: 'bg-emerald-500',
    countClass: 'bg-emerald-500/20 text-emerald-600',
    borderClass: 'border-emerald-200/50 dark:border-emerald-900/50',
  },
];

// -----------------------------------------------------------------------------
// Column component
// -----------------------------------------------------------------------------
const KanbanColumn = ({ column, tasks, staffMap, onCardClick, onAddTask, canAdd }) => {
  const taskIds = tasks.map((t) => t.id);

  return (
    <div className={`flex flex-col rounded-2xl border bg-gradient-to-b ${column.colorClass} ${column.borderClass} min-w-[280px] max-w-[320px] flex-1`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.dotClass}`} />
          <h3 className={`font-semibold text-sm ${column.headerClass}`}>{column.label}</h3>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${column.countClass}`}>
            {tasks.length}
          </span>
        </div>
        {canAdd && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/20"
            onClick={() => onAddTask?.(column.id)}
            title={`Add task to ${column.label}`}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px] max-h-[calc(100vh-280px)]">
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
 * @param {Function} props.onCardClick    - (task) => void — open task details
 * @param {Function} props.onAddTask      - (defaultStatus) => void — open add dialog (admin only)
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
    >
      {/* Horizontal scrollable board */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-0.5 -mx-0.5">
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

      {/* Drag overlay — floating clone while dragging */}
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
