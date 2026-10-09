// The status picker for a task: the built-in statuses, each followed by the organisation's
// stages inside it (lib/stages). The value is "status" or "status::stageId";
// TasksContext.updateTaskStatus understands both.
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStages } from '@/contexts/TasksContext';
import { optionValue, statusOptions } from '@/lib/stages';

const StatusSelect = ({ task, onChange, id, className, ariaLabel, onClick }) => {
  const stages = useStages();
  return (
    <Select value={optionValue(task, stages)} onValueChange={onChange}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel} onClick={onClick}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions(stages).map((o) => (
          <SelectItem key={o.value} value={o.value} className={o.stage ? 'pl-10' : undefined}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StatusSelect;
