// Watch / stop watching a task (lib/watchers). Watchers hear in the bell when its status
// changes or someone comments, and see it under "Watching" in My Work.
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setWatching } from '@/services/taskService';
import { isWatching } from '@/lib/watchers';
import { reportError } from '@/lib/reportError';

const WatchButton = ({ task, uid }) => {
  const [on, setOn] = useState(() => isWatching(task, uid));
  const [busy, setBusy] = useState(false);
  if (!uid || !task?.id) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      await setWatching(task.id, uid, !on);
      setOn(!on);
    } catch (error) {
      reportError(error, { title: on ? 'Could not stop watching' : 'Could not watch this task' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" size="sm" variant={on ? 'secondary' : 'outline'} onClick={toggle} disabled={busy} aria-pressed={on}>
      {on ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      {on ? 'Stop watching' : 'Watch'}
    </Button>
  );
};

export default WatchButton;
