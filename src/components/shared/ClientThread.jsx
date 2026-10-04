// A task's conversation between the team and the client: the messages, oldest first, and a
// box to add one. Used by the client portal and by the team's task view (ClientConversation).
import React, { useId, useState } from 'react';
import { CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import FieldError from '@/components/shared/FieldError';
import { MAX_MESSAGE, messageProblem } from '@/lib/clientThread';
import { formatDateTime, formatRelative } from '@/lib/format';

const DecisionLine = ({ m }) => {
  const approved = m.kind === 'approved';
  const Icon = approved ? CheckCircle2 : AlertTriangle;
  return (
    <p className={`flex items-center gap-1.5 text-sm font-medium ${approved ? 'text-success' : 'text-warning'}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {approved ? 'Approved this milestone' : 'Asked for changes'}
    </p>
  );
};

const ClientThread = ({ messages = [], viewerIsClient, onSend, composeLabel, emptyText, disabled = false }) => {
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const problem = messageProblem(text);
    if (problem) { setError(problem); return; }
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
      setError('');
    } catch {
      setError("Couldn't send that. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="space-y-2" aria-label="Messages, oldest first">
          {messages.map((m) => {
            const mine = m.fromClient === Boolean(viewerIsClient);
            return (
              <li
                key={m.id}
                className={`rounded-xl border p-3 text-sm ${m.fromClient ? 'border-border bg-muted/40' : 'border-primary/20 bg-primary-soft'} ${mine ? 'sm:ml-8' : 'sm:mr-8'}`}
              >
                <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.authorName || 'Someone'}</span>
                  <span>{m.fromClient ? 'Client' : 'Project team'}</span>
                  <time title={formatDateTime(m.createdAt)}>{m.createdAt ? formatRelative(m.createdAt) : 'sending…'}</time>
                </p>
                {m.kind !== 'message' && <DecisionLine m={m} />}
                {m.text && <p className="whitespace-pre-wrap break-words text-foreground">{m.text}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {onSend && (
        <form onSubmit={send} className="space-y-2" noValidate>
          <label htmlFor={`${id}-text`} className="text-sm font-medium text-foreground">{composeLabel}</label>
          <Textarea
            id={`${id}-text`}
            rows={2}
            maxLength={MAX_MESSAGE}
            value={text}
            onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
            disabled={disabled || sending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <FieldError id={`${id}-error`}>{error}</FieldError>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={disabled || sending}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ClientThread;
