// Workflow stages (lib/stages): the organisation's own steps inside the built-in statuses,
// e.g. "QA" and "Client check" inside In review. Org admins edit them on the Task Fields page.
import React, { useId, useState } from 'react';
import { Trash2, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useStages } from '@/contexts/TasksContext';
import { saveStages } from '@/services/stageService';
import { CATEGORIES, MAX_STAGES, newStageId } from '@/lib/stages';
import { statusLabel } from '@/lib/taskLabels';
import { reportError } from '@/lib/reportError';

const WorkflowStagesCard = () => {
  const { currentUser } = useAuth();
  const stages = useStages();
  const id = useId();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('in-progress');
  const [saving, setSaving] = useState(false);

  const store = async (next) => {
    setSaving(true);
    try {
      await saveStages(currentUser.orgId, next); // the live listener brings the result back
    } catch (error) {
      reportError(error, { title: "Couldn't save the stages" });
    } finally {
      setSaving(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await store([...stages, { id: newStageId(name, stages), name: name.trim(), category }]);
    setName('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" aria-hidden="true" /> Workflow stages</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own steps inside each status, like “QA” or “Client check” inside In review. They show in every status picker;
          the board columns, dependencies and reports still go by the status.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1 space-y-1">
            <Label htmlFor={`${id}-name`}>Stage</Label>
            <Input id={`${id}-name`} value={name} maxLength={40} placeholder="QA" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-category`}>Inside</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id={`${id}-category`} className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{statusLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={saving || !name.trim() || stages.length >= MAX_STAGES}>Add stage</Button>
        </form>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stages: tasks use the built-in statuses only.</p>
        ) : (
          <ul className="space-y-3">
            {CATEGORIES.filter((c) => stages.some((s) => s.category === c)).map((c) => (
              <li key={c}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{statusLabel(c)}</h3>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {stages.filter((s) => s.category === c).map((s) => (
                    <li key={s.id} className="flex items-center gap-1 rounded-full border border-border py-0.5 pl-3 pr-1 text-sm">
                      {s.name}
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove the stage ${s.name}`} disabled={saving}
                        onClick={() => store(stages.filter((x) => x.id !== s.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowStagesCard;
