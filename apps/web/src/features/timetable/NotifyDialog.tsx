import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { appointmentMessage, whatsappMessageLink, type TimetableEvent } from '@maxsen/domain';
import { Button, Dialog } from '@/components/ui';
import { cn } from '@/lib/cn';
import { savedByName } from '@/lib/shared/api';

/**
 * Tells the people assigned to an appointment about it on WhatsApp: one message each, written
 * for them, opened in WhatsApp (on this phone, tablet or computer) to send.
 */
export function NotifyDialog({
  event,
  changed,
  phones,
  onClose,
}: {
  event: TimetableEvent | null;
  /** An appointment changed, rather than a new one. */
  changed: boolean;
  phones: Record<string, string>;
  onClose: () => void;
}) {
  const [sent, setSent] = useState<string[]>([]);
  if (!event) return null;
  const from = savedByName();

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width="sm"
      title="Tell them on WhatsApp"
      description={`${changed ? 'The changes to' : 'Their part in'} “${event.title}”, a message for each person, written and ready to send.`}
      footer={<Button onClick={onClose}>{sent.length ? 'Done' : 'Not now'}</Button>}
    >
      <ul aria-label="People to tell" className="flex flex-col divide-y divide-rule">
        {event.people.map((name) => {
          const phone = phones[name];
          const done = sent.includes(name);
          return (
            <li key={name} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-body text-ink">{name}</span>
                <span className="text-meta text-ink-3">
                  {phone ?? 'No number yet: you’ll pick them in WhatsApp (add it under Team)'}
                </span>
              </span>
              <a
                href={whatsappMessageLink(
                  phone,
                  appointmentMessage(event, name, { changed, from: from || undefined }),
                )}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSent((s) => [...new Set([...s, name])])}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border px-3 text-control font-medium',
                  done
                    ? 'border-rule-2 text-ink-2'
                    : 'border-transparent bg-[#25D366] text-white hover:bg-[#1ebe5a]',
                )}
              >
                {done ? (
                  <Check aria-hidden className="size-4" />
                ) : (
                  <MessageCircle aria-hidden className="size-4" />
                )}
                {done ? 'Opened' : 'Send on WhatsApp'}
              </a>
            </li>
          );
        })}
      </ul>
      {!event.people.length && (
        <p className="text-meta text-ink-2">No one is assigned to this appointment yet.</p>
      )}
    </Dialog>
  );
}
