import { useMemo, useState } from 'react';
import { CloudOff, MessageCircle, Phone, Plus, Search, TriangleAlert } from 'lucide-react';
import {
  byPriority,
  channelOf,
  isOpen,
  isOverdue,
  LEAD_CHANNEL_LABEL,
  LEAD_CHANNELS,
  LEAD_STATUS_LABEL,
  LEAD_STATUSES,
  matchLead,
  whatsappLink,
  type Lead,
  type LeadChannel,
  type LeadStatus,
} from '@maxsen/domain';
import { Button, Input, PageHeader, SegmentedControl, Select, useToast } from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/useAdmin';
import { cn } from '@/lib/cn';
import { formatDay, relativeDay, today } from '@/lib/dates';
import { useEnsureName } from '@/lib/shared/useEnsureName';
import { useTimetable } from '@/features/timetable/timetable-api';
import { LeadDialog } from './LeadDialog';
import { LeadError, saveLead, useLeads } from './leads-api';

type Filter = 'open' | 'all' | LeadStatus;
type Channel = 'all' | LeadChannel;
const EVERYONE = '__all__';
const CHANNEL_KEY = 'maxsen.leads.channel';

function savedChannel(): Channel {
  try {
    const c = window.localStorage.getItem(CHANNEL_KEY);
    return c === 'mydigitallock' || c === 'own' ? c : 'all';
  } catch {
    return 'all';
  }
}

const STATUS_TONE: Record<LeadStatus, string> = {
  new: 'bg-sales-tint text-sales',
  contacted: 'bg-paper text-ink-2',
  meeting: 'bg-brass-tint text-brass-2',
  quoted: 'bg-brass-tint text-brass-2',
  won: 'bg-ok/10 text-ok',
  lost: 'bg-paper text-ink-3',
};

/**
 * The team's leads: everyone adds them and keeps them moving. Saved on the team server, each
 * lead on its own, so nothing anyone types is lost to someone else's change or an app update.
 */
export function LeadsScreen() {
  const { leads, state, refresh, put, drop } = useLeads();
  const { timetable } = useTimetable();
  const { requireAdmin } = useAdmin();
  const { toast } = useToast();
  const { ensureName, dialog: nameDialog } = useEnsureName();
  const [channel, setChannelState] = useState<Channel>(savedChannel);
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState(EVERYONE);
  const [opened, setOpened] = useState<Lead | 'new' | null>(null);
  const day = today();

  const people = useMemo(
    () =>
      [
        ...new Set([
          ...timetable.people,
          ...leads.flatMap((l) => (l.assignedTo ? [l.assignedTo] : [])),
        ]),
      ].sort(),
    [timetable.people, leads],
  );
  const setChannel = (c: Channel) => {
    setChannelState(c);
    try {
      window.localStorage.setItem(CHANNEL_KEY, c);
    } catch {
      // Remembered for this visit only.
    }
  };
  // MyDigitalLock's leads and our own are worked as separate lists.
  const inChannel = leads.filter((l) => channel === 'all' || channelOf(l) === channel);
  const openIn = (c: Channel) =>
    leads.filter((l) => isOpen(l) && (c === 'all' || channelOf(l) === c)).length;
  const count = (f: Filter) =>
    inChannel.filter((l) => (f === 'all' ? true : f === 'open' ? isOpen(l) : l.status === f))
      .length;
  const shown = inChannel
    .filter((l) => (filter === 'all' ? true : filter === 'open' ? isOpen(l) : l.status === filter))
    .filter((l) => person === EVERYONE || l.assignedTo === person)
    .filter((l) => matchLead(l, search))
    .sort(byPriority(day));
  const overdue = inChannel.filter((l) => isOverdue(l, day)).length;

  const setStatus = async (l: Lead, status: LeadStatus) => {
    if (!(await ensureName())) return;
    try {
      const {
        id: _id,
        notes: _n,
        createdAt: _c,
        createdBy: _cb,
        updatedAt,
        updatedBy: _u,
        ...rest
      } = l;
      put(await saveLead(l.id, { ...rest, status, baseUpdatedAt: updatedAt }));
    } catch (e) {
      toast({
        title:
          e instanceof LeadError && e.current ? 'Changed by someone else just now' : 'Not saved',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
      void refresh();
    }
  };

  if (state === 'unavailable')
    return (
      <Page>
        <PageHeader title="Leads" />
        <p className="flex items-center gap-2 border-t border-rule py-10 text-body text-ink-2">
          <CloudOff aria-hidden className="size-5" />
          Leads are shared through the team server, which can’t be reached from here.
        </p>
      </Page>
    );

  return (
    <Page wide>
      <PageHeader
        title="Leads"
        description="Every enquiry, from first contact to won or lost. Everyone on the team adds and updates them; they’re kept on the team server."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setOpened('new')}
          >
            New lead
          </Button>
        }
      />
      <SegmentedControl<Channel>
        label="Lead from"
        className="mb-3"
        value={channel}
        onChange={setChannel}
        options={[
          {
            value: 'all',
            label: (
              <>
                All leads <span className="tnum opacity-70">{openIn('all')}</span>
              </>
            ),
          },
          ...LEAD_CHANNELS.map((c) => ({
            value: c,
            label: (
              <>
                {LEAD_CHANNEL_LABEL[c]} <span className="tnum opacity-70">{openIn(c)}</span>
              </>
            ),
          })),
        ]}
      />
      <div role="group" aria-label="Filter by status" className="mb-3 flex flex-wrap gap-1.5">
        {(['open', ...LEAD_STATUSES, 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-chip border px-2.5 py-1 text-meta font-medium',
              filter === f
                ? 'border-ink bg-ink text-surface'
                : 'border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink',
            )}
          >
            {f === 'open' ? 'Open' : f === 'all' ? 'All' : LEAD_STATUS_LABEL[f]}{' '}
            <span className="tnum opacity-70">{count(f)}</span>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="w-80">
          <Input
            type="search"
            compact
            aria-label="Search leads"
            leading={<Search />}
            placeholder="Name, phone, address or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            compact
            aria-label="Assigned to"
            value={person}
            onChange={setPerson}
            options={[
              { value: EVERYONE, label: 'Everyone’s' },
              ...people.map((p) => ({ value: p, label: p })),
            ]}
          />
        </div>
        {overdue > 0 && (
          <span className="flex items-center gap-1.5 text-control text-danger">
            <TriangleAlert aria-hidden className="size-4" />
            {overdue} follow-up{overdue === 1 ? '' : 's'} overdue
          </span>
        )}
        {state === 'offline' && (
          <span className="flex items-center gap-1.5 text-meta text-ink-2">
            <CloudOff aria-hidden className="size-4" />
            Offline: showing the last copy
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-rule py-10 text-body text-ink-2">
          {inChannel.length ? 'No leads match.' : 'No leads yet. Add the first with New lead.'}
        </p>
      ) : (
        <ul aria-label="Leads" className="border-t border-rule">
          {shown.map((l) => {
            const late = isOverdue(l, day);
            const wa = l.phone ? whatsappLink(l.phone) : null;
            const last = l.notes.at(-1);
            return (
              <li
                key={l.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_150px_140px] items-center gap-x-4 gap-y-1 border-b border-rule py-2.5 max-[900px]:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpened(l)}
                    className="text-left text-body font-medium text-ink hover:underline"
                  >
                    {l.name}
                  </button>
                  <p className="flex items-center gap-2 text-meta text-ink-2">
                    {l.phone && (
                      <a
                        href={`tel:${l.phone.replace(/\s/g, '')}`}
                        className="flex items-center gap-1 hover:text-ink"
                      >
                        <Phone aria-hidden className="size-3" />
                        {l.phone}
                      </a>
                    )}
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`WhatsApp ${l.name}`}
                        className="text-ok"
                      >
                        <MessageCircle className="size-3.5" />
                      </a>
                    )}
                    {channel === 'all' && channelOf(l) === 'mydigitallock' && (
                      <span className="rounded-chip bg-sales-tint px-1.5 text-caption font-semibold text-sales">
                        MyDigitalLock
                      </span>
                    )}
                    {l.source && <span>· {l.source}</span>}
                  </p>
                </div>
                <div className="min-w-0 text-meta text-ink-2 max-[900px]:col-span-2 max-[900px]:row-start-2">
                  {l.interest && <p className="truncate text-ink">{l.interest}</p>}
                  {last && (
                    <p className="truncate">
                      {last.by}: {last.text}
                    </p>
                  )}
                </div>
                <select
                  aria-label={`Status of ${l.name}`}
                  value={l.status}
                  onChange={(e) => void setStatus(l, e.target.value as LeadStatus)}
                  className={cn(
                    'h-7 rounded-chip border-0 px-2 text-meta font-semibold',
                    STATUS_TONE[l.status],
                  )}
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="text-meta max-[900px]:col-span-2">
                  {l.followUp ? (
                    <span
                      title={formatDay(l.followUp)}
                      className={cn(late ? 'font-semibold text-danger' : 'text-ink-2')}
                    >
                      Follow up {relativeDay(l.followUp, day).toLowerCase()}
                    </span>
                  ) : (
                    <span className="text-ink-3">No follow-up set</span>
                  )}
                  {l.assignedTo && <span className="block text-ink-3">{l.assignedTo}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nameDialog}
      {opened && (
        <LeadDialog
          key={opened === 'new' ? 'new' : opened.id}
          open
          lead={opened === 'new' ? null : opened}
          channel={channel === 'all' ? undefined : channel}
          people={people}
          ensureName={ensureName}
          requireAdmin={requireAdmin}
          onClose={() => setOpened(null)}
          onSaved={put}
          onDeleted={(id) => {
            drop(id);
            toast({ title: 'Lead deleted' });
          }}
        />
      )}
    </Page>
  );
}
