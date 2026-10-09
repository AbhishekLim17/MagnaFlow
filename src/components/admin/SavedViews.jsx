// Saved views for the task list (lib/savedViews): pick one to apply its filters and view,
// save the current ones under a name, or delete one. Stored on the person's own profile.
import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Bookmark, Trash2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { reportError } from '@/lib/reportError';
import { addView, readViews, removeView } from '@/lib/savedViews';

// This session's latest list per person (the profile in AuthContext is read once at sign-in).
const latest = new Map();

const SavedViews = ({ search, mode, onApply }) => {
  const { user } = useAuth(); // the whole profile (currentUser carries only the access fields)
  const uid = user?.id || user?.uid;
  const [views, setViews] = useState(() => latest.get(uid) || readViews(user?.savedViews));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const store = async (next) => {
    const before = views;
    setViews(next);
    latest.set(uid, next);
    try {
      await updateDoc(doc(db, 'users', uid), { savedViews: next });
    } catch (error) {
      setViews(before);
      latest.set(uid, before);
      reportError(error, { title: 'Could not save your views' });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await store(addView(views, name, search, mode));
    setName('');
    setNaming(false);
  };

  // The view whose filters are the ones on screen, if any.
  const chosen = views.find((v) => v.search === search)?.name || '';
  const apply = (viewName) => {
    const view = views.find((v) => v.name === viewName);
    if (view) onApply(view);
  };

  if (!uid) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.length > 0 && (
        <>
          <Select value={chosen} onValueChange={apply}>
            <SelectTrigger className="h-9 w-[180px] bg-muted" aria-label="Saved views">
              <SelectValue placeholder="Saved views" />
            </SelectTrigger>
            <SelectContent>
              {views.map((v) => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {chosen && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Delete the saved view ${chosen}`}
              onClick={() => store(removeView(views, chosen))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
      {naming ? (
        <form onSubmit={save} className="flex items-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this view"
            aria-label="Name for the saved view"
            maxLength={40}
            className="h-9 w-[180px]"
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(false)}>Cancel</Button>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setNaming(true)}>
          <Bookmark className="h-4 w-4" aria-hidden="true" /> Save view
        </Button>
      )}
    </div>
  );
};

export default SavedViews;
