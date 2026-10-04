// The team's side of a task's client conversation (task details). Live, so a client's
// reply appears while the task is open. Only for tasks that belong to a project: clients
// are linked to projects.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ClientThread from '@/components/shared/ClientThread';
import { sendClientMessage, subscribeTaskMessages } from '@/services/clientMessageService';
import { approvalSummary } from '@/lib/clientThread';
import { formatDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';
import { safeUnsubscribe } from '@/lib/safeUnsubscribe';

export const ApprovalStatus = ({ task }) => {
  const a = approvalSummary(task);
  if (!a) return null;
  const approved = a.decision === 'approved';
  const Icon = approved ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-xl border p-3 text-sm ${approved ? 'border-success/30 bg-success/10' : 'border-warning/40 bg-warning-soft'}`}>
      <p className={`flex items-center gap-1.5 font-medium ${approved ? 'text-success' : 'text-warning'}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {approved ? `Approved by ${a.by}` : `${a.by} asked for changes`}
        {a.at && <span className="font-normal text-muted-foreground">· {formatDate(a.at)}</span>}
      </p>
      {a.note && <p className="mt-1 whitespace-pre-wrap text-foreground">{a.note}</p>}
    </div>
  );
};

const ClientConversation = ({ task }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const taskId = task?.id;

  useEffect(() => {
    if (!taskId) return undefined;
    const unsubscribe = subscribeTaskMessages(taskId, setMessages, (error) =>
      reportError(error, { title: "Couldn't load the client conversation", silent: true }));
    return () => safeUnsubscribe(unsubscribe);
  }, [taskId]);

  if (!task?.projectId) return null;

  const send = async (text) => {
    try {
      await sendClientMessage({ task, author: currentUser, fromClient: false, text });
    } catch (error) {
      reportError(error, { title: "Couldn't send your message to the client" });
      throw error;
    }
  };

  return (
    <section aria-labelledby={`client-conv-${task.id}`} className="space-y-3">
      <div>
        <h3 id={`client-conv-${task.id}`} className="flex items-center gap-2 font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          Conversation with the client
        </h3>
        <p className="text-xs text-muted-foreground">
          The project&apos;s clients see these messages in their portal and get an email. Internal comments stay below.
        </p>
      </div>
      <ApprovalStatus task={task} />
      <ClientThread
        messages={messages}
        viewerIsClient={false}
        onSend={send}
        composeLabel="Message the client"
        emptyText="No messages with the client yet."
      />
    </section>
  );
};

export default ClientConversation;
