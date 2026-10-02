// KanbanCard.jsx � individual draggable task card for the Kanban board
// Uses @dnd-kit/sortable for drag-and-drop integration

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Calendar, User, MessageSquare, ListChecks, AlertCircle, GripVertical, Lock } from 'lucide-react';
import { useCommentCount } from '@/hooks/useCommentCount';
import { useSubtaskCount } from '@/hooks/useSubtaskCount';
import { formatDateShort } from '@/lib/format';
import { isOverdueTask } from '@/lib/taskState';

const PRIORITY_STYLES = {
  critical: { bg: 'bg-destructive-soft border-destructive/40 text-destructive', dot: 'bg-destructive', label: 'Critical' },
  high:     { bg: 'bg-warning-soft border-warning/40 text-warning',             dot: 'bg-warning',     label: 'High'     },
  medium:   { bg: 'bg-info-soft border-info/30 text-info',                    dot: 'bg-info',        label: 'Medium'   },
  low:      { bg: 'bg-success-soft border-success/40 text-success',             dot: 'bg-success',     label: 'Low'      },
};

const formatDate = (timestamp) => (timestamp ? formatDateShort(timestamp) : null);


/**
 * Draggable task card for the Kanban board.
 * @param {Object}   props.task         - Full task document
 * @param {Object}   props.staffMap     - Map of userId -> name
 * @param {Function} props.onCardClick  - Open task details dialog
 * @param {boolean}  props.isDragging   - True when this is the drag overlay clone
 */
const KanbanCard = ({ task, staffMap = {}, onCardClick, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const commentCount = useCommentCount(task.id);
  const subtaskCounts = useSubtaskCount(task.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const overdue = isOverdueTask(task);
  const subtaskProgress = subtaskCounts.total > 0
    ? Math.round((subtaskCounts.completed / subtaskCounts.total) * 100)
    : null;
  const assigneeName = task.assignedTo ? staffMap[task.assignedTo] || 'Unknown' : null;
  // Fix #13: show a locked badge when predecessor tasks are still open
  const isBlocked = Array.isArray(task.blockedBy) && task.blockedBy.length > 0 && task.status !== 'completed';

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        whileHover={!isSortableDragging ? { y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.12)' } : {}}
        className={[
          'group relative rounded-xl border bg-card p-4 cursor-pointer select-none transition-shadow duration-200',
          isDragging ? 'ring-2 ring-primary shadow-2xl scale-[1.02] rotate-1' : '',
        ].join(' ')}
        onClick={() => onCardClick?.(task)}
      >
        {/* Drag handle: a 40px target on touch screens (it was 20px and only visible on hover),
            and touch-none so a finger on it drags the card instead of scrolling the page. */}
        <div
          {...listeners}
          {...attributes}
          aria-label={`Move ${task.title}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 z-10 grid h-10 w-10 touch-none place-items-center rounded-lg opacity-60 cursor-grab active:cursor-grabbing hover:bg-muted hover:opacity-100 focus-visible:opacity-100 transition-opacity sm:right-2 sm:top-2 sm:h-8 sm:w-8 sm:opacity-30 sm:group-hover:opacity-70"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Priority indicator dot + title */}
        <div className="flex items-start gap-2 mb-2 pr-8">
          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priority.dot}`} />
          <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {/* The keyboard way in. Its ::after stretches over the whole card, so a click
                anywhere on the card lands here and bubbles up to the card's onClick; this
                button needs no handler of its own. (A role on the card itself would nest
                the drag handle inside another interactive element.) */}
            <button
              type="button"
              className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:rounded-xl"
            >
              {task.title}
            </button>
          </h3>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 pl-4">{task.description}</p>
        )}

        {/* Subtask progress bar */}
        {subtaskProgress !== null && (
          <div className="mb-3 pl-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ListChecks className="w-3 h-3" />
                {subtaskCounts.completed}/{subtaskCounts.total}
              </span>
              <span className="text-xs text-muted-foreground">{subtaskProgress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${subtaskProgress}%` }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-3 pl-4">
          <div className="flex items-center gap-2 flex-wrap">
            {isBlocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-destructive/10 text-destructive border-destructive/30">
                <Lock className="w-2.5 h-2.5" />Blocked
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${priority.bg}`}>
              {priority.label}
            </span>
            {assigneeName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{assigneeName}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            {commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />{commentCount}
              </span>
            )}
            {task.deadline && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : ''}`}>
                {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {formatDate(task.deadline)}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default KanbanCard;
