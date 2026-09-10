// KanbanCard.jsx — individual draggable task card for the Kanban board
// Uses @dnd-kit/sortable for drag-and-drop integration

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Calendar, User, MessageSquare, ListChecks, AlertCircle, GripVertical } from 'lucide-react';
import { useCommentCount } from '@/hooks/useCommentCount';
import { useSubtaskCount } from '@/hooks/useSubtaskCount';

const PRIORITY_STYLES = {
  critical: { bg: 'bg-destructive-soft border-destructive/40 text-destructive', dot: 'bg-destructive', label: 'Critical' },
  high:     { bg: 'bg-warning-soft border-warning/40 text-warning',             dot: 'bg-warning',     label: 'High'     },
  medium:   { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600',         dot: 'bg-amber-500',   label: 'Medium'   },
  low:      { bg: 'bg-success-soft border-success/40 text-success',             dot: 'bg-success',     label: 'Low'      },
};

const formatDate = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (timestamp, status) => {
  if (!timestamp) return false;
  if (status === 'completed' || status === 'done' || status === 'review') return false;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date < new Date();
};

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
  const overdue = isOverdue(task.deadline, task.status);
  const subtaskProgress = subtaskCounts.total > 0
    ? Math.round((subtaskCounts.completed / subtaskCounts.total) * 100)
    : null;
  const assigneeName = task.assignedTo ? staffMap[task.assignedTo] || 'Unknown' : null;

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
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing p-0.5 rounded hover:opacity-80 transition-opacity"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Priority indicator dot + title */}
        <div className="flex items-start gap-2 mb-2 pr-6">
          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priority.dot}`} />
          <h4 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{task.title}</h4>
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
