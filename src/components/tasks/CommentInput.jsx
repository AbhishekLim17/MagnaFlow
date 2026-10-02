import { useState, useEffect, useRef, useId } from 'react';
import { createComment } from '../../services/commentService';
import { sendMentionEmail } from '../../services/emailService';
import {
  resolveMentions, mergePeople, getMentionQuery, suggestPeople, applyMention,
} from '../../lib/mentions';
import { createNotificationsForMentions } from '../../services/notificationService';
import { getAllUsers } from '../../services/userService';
import { useToast } from '@/components/ui/use-toast';
import { toUserMessage } from '@/lib/errorMessages';
import { roleLabel } from '@/lib/taskLabels';
import { Send, AtSign } from 'lucide-react';
import { motion } from 'framer-motion';

const MAX_LENGTH = 5000;

/**
 * CommentInput Component
 * Textarea for posting new comments. Typing "@" opens a list of people to mention
 * (arrow keys + Enter, or click). Ctrl/Cmd+Enter posts.
 */
const CommentInput = ({ taskId, taskTitle, userId, userName, userEmail, people = [] }) => {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [directory, setDirectory] = useState([]);
  // The "@..." being typed at the caret, if any, and which suggestion is highlighted.
  const [mention, setMention] = useState(null); // { start, query }
  const [active, setActive] = useState(0);
  const textareaRef = useRef(null);
  const listId = useId();

  const remainingChars = MAX_LENGTH - text.length;

  // Load users once for mention suggestions. What this returns depends on the
  // caller's role (the security rules only let org-admins list everyone), so it
  // is merged with the people already visible on the task - its commenters.
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        setDirectory(allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
      } catch {
        // Expected for roles that cannot list users; commenters still work.
      }
    };
    loadUsers();
  }, [userId]);

  const users = mergePeople(directory, people).filter((u) => u.id !== userId && u.name);
  const suggestions = mention ? suggestPeople(users, mention.query) : [];
  const open = suggestions.length > 0;

  const syncMention = (value, caret) => {
    const next = getMentionQuery(value, caret);
    setMention(next);
    setActive(0);
  };

  const handleChange = (e) => {
    setText(e.target.value);
    syncMention(e.target.value, e.target.selectionStart);
  };

  const choose = (person) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const next = applyMention(text, mention.start, caret, person);
    setText(next.text);
    setMention(null);
    // Put the cursor back after the inserted name once React has re-rendered.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      }
    });
  };

  const handleKeyDown = (e) => {
    // Ctrl/Cmd+Enter always posts, even with the list open (plain Enter picks a name).
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(suggestions[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); }
    }
  };

  // Handle comment submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) {
      setError('Write something before posting.');
      textareaRef.current?.focus();
      return;
    }
    if (loading) return;

    setLoading(true);
    setError(null);

    let newComment;
    try {
      // Resolve @mentions against the people the picker offered
      const mentioned = resolveMentions(text, users);
      const mentionedUserIds = mentioned.map((p) => p.id);

      newComment = await createComment(taskId, userId, userName, userEmail, text, mentionedUserIds);

      // Tell the people who were mentioned. The comment is already posted, so a failure
      // here must not look like the comment failed - but it must not be silent either.
      if (mentionedUserIds.length > 0) {
        try {
          await createNotificationsForMentions(
            mentionedUserIds,
            newComment.id,
            taskId,
            userId,
            userName,
            { taskTitle, excerpt: text.replace(/\s+/g, ' ').trim() }
          );

          // Queue an email for each mentioned person, by uid (delivery is by the
          // scheduled job, which looks the address up and re-checks the org).
          await Promise.all(
            mentioned.map((p) => sendMentionEmail({
              toUid: p.id,
              taskTitle,
              commentText: text,
              mentionedBy: userName,
              taskId,
            }))
          );
        } catch (notifError) {
          console.error('Failed to notify mentioned people:', notifError);
          toast({
            title: 'Comment posted',
            description: "We couldn't notify the people you mentioned, so they may not see it right away.",
            variant: 'destructive',
          });
        }
      }

      setText('');
      setMention(null);
    } catch (err) {
      console.error('Error creating comment:', err);
      setError(toUserMessage(err, 'Your comment was not posted. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <label htmlFor={`${listId}-comment`} className="sr-only">Add a comment</label>
        <textarea
          id={`${listId}-comment`}
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => syncMention(e.target.value, e.target.selectionStart)}
          onKeyUp={(e) => {
            // Arrow keys move the caret without changing the text.
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) syncMention(e.target.value, e.target.selectionStart);
          }}
          placeholder="Write a comment… type @ to mention someone"
          className="w-full px-4 py-3 bg-muted border border-border text-foreground rounded-xl focus:ring-2 ring-primary focus:border-transparent resize-none"
          rows="3"
          maxLength={MAX_LENGTH}
          disabled={loading}
          // A textarea cannot take role=combobox (ARIA in HTML), so it stays a textbox that
          // points at the list; the count below is announced when the list opens.
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
        />

        <p className="sr-only" role="status">
          {open ? `${suggestions.length} ${suggestions.length === 1 ? 'person' : 'people'} to mention. Use the up and down arrow keys, then Enter.` : ''}
        </p>

        {/* Mention suggestions */}
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="People to mention"
            className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card p-1 shadow-overlay"
          >
            {suggestions.map((person, i) => (
              <li
                key={person.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the textarea would lose focus (and the list vanish) first
                onMouseDown={(e) => { e.preventDefault(); choose(person); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-primary-soft text-foreground' : 'text-foreground'}`}
              >
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{person.name}</span>
                {person.role && <span className="ml-auto text-xs text-muted-foreground">{roleLabel(person.role)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-destructive text-sm"
          role="alert"
        >
          {error}
        </motion.div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {remainingChars < 500 ? `${remainingChars} characters left · ` : ''}
          Press <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl</kbd>+
          <kbd className="rounded border border-border px-1 font-mono text-[10px]">Enter</kbd> to post
        </p>

        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          {loading ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
};

export default CommentInput;
