import { useMemo, useState } from 'react';
import { CloudOff, Download, Paperclip, Plus, Search } from 'lucide-react';
import {
  byNewest,
  CLAIM_STATUS_LABEL,
  claimsTotal,
  matchClaim,
  type Claim,
  type ClaimStatus,
} from '@maxsen/domain';
import { Button, Input, PageHeader, SegmentedControl, Select } from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/useAdmin';
import { cn } from '@/lib/cn';
import { formatDay, today } from '@/lib/dates';
import { useEnsureName } from '@/lib/shared/useEnsureName';
import { money } from '@/features/quote/quotation';
import { ClaimDialog } from './ClaimDialog';
import { useClaims } from './claims-api';

type Filter = 'all' | ClaimStatus;
const EVERYONE = '__all__';

const STATUS_TONE: Record<ClaimStatus, string> = {
  pending: 'bg-warn-tint text-warn',
  approved: 'bg-ok/10 text-ok',
  rejected: 'bg-danger/10 text-danger',
};

/** The claims shown, as a spreadsheet (CSV) for paying them out or the accounts. */
function downloadCsv(claims: Claim[]) {
  const cell = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    [
      'Date',
      'Claimant',
      'Amount (S$)',
      'Purpose',
      'Category',
      'Site',
      'Status',
      'Decided by',
      'Note',
    ],
    ...claims.map((c) => [
      c.date,
      c.claimant,
      c.amount.toFixed(2),
      c.purpose,
      c.category,
      c.site,
      CLAIM_STATUS_LABEL[c.status],
      c.decidedBy,
      c.note,
    ]),
  ];
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Claims ${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * The team's expense claims: anyone claims with the receipt and what it was for; the admin
 * approves or rejects. Kept on the team server, so everyone sees where theirs stands.
 */
export function ClaimsScreen() {
  const { claims, state, put, drop } = useClaims();
  const { unlocked, requireAdmin } = useAdmin();
  const { ensureName, dialog: nameDialog } = useEnsureName();
  const [filter, setFilter] = useState<Filter>('pending');
  const [person, setPerson] = useState(EVERYONE);
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<Claim | 'new' | null>(null);

  const people = useMemo(() => [...new Set(claims.map((c) => c.claimant))].sort(), [claims]);
  const mine = (c: Claim) => person === EVERYONE || c.claimant === person;
  const count = (f: Filter) => claims.filter((c) => mine(c) && (f === 'all' || c.status === f));
  const shown = claims
    .filter((c) => mine(c) && (filter === 'all' || c.status === filter))
    .filter((c) => matchClaim(c, search))
    .sort(byNewest);
  const month = today().slice(0, 7);
  const approvedThisMonth = claims.filter(
    (c) => mine(c) && c.status === 'approved' && (c.decidedAt ?? c.date).startsWith(month),
  );

  if (state === 'unavailable')
    return (
      <Page>
        <PageHeader title="Claims" />
        <p className="flex items-center gap-2 border-t border-rule py-10 text-body text-ink-2">
          <CloudOff aria-hidden className="size-5" />
          Claims are kept on the team server, which can’t be reached from here.
        </p>
      </Page>
    );

  return (
    <Page wide>
      <PageHeader
        title="Claims"
        description="Paid for something for work? Claim it here with the receipt and what it was for. The admin approves or rejects each claim."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setOpened('new')}
          >
            New claim
          </Button>
        }
      />
      <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-meta text-ink-2">Waiting for approval</dt>
          <dd className="tnum text-title text-ink" data-testid="claims-pending">
            {money(claimsTotal(count('pending')))}
            <span className="ml-1.5 text-meta text-ink-3">{count('pending').length} claims</span>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-2">Approved this month</dt>
          <dd className="tnum text-title text-ink">{money(claimsTotal(approvedThisMonth))}</dd>
        </div>
      </dl>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={(['pending', 'approved', 'rejected', 'all'] as const).map((f) => ({
            value: f,
            label: (
              <>
                {f === 'all' ? 'All' : f === 'pending' ? 'Waiting' : CLAIM_STATUS_LABEL[f]}{' '}
                <span className="tnum opacity-70">{count(f).length}</span>
              </>
            ),
          }))}
        />
        <div className="w-44">
          <Select
            compact
            aria-label="Whose claims"
            value={person}
            onChange={setPerson}
            options={[
              { value: EVERYONE, label: 'Everyone’s' },
              ...people.map((p) => ({ value: p, label: p })),
            ]}
          />
        </div>
        <div className="w-64">
          <Input
            type="search"
            compact
            aria-label="Search claims"
            leading={<Search />}
            placeholder="What for, who, site"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          icon={<Download className="size-4" />}
          disabled={!shown.length}
          onClick={() => downloadCsv(shown)}
          className="ml-auto"
        >
          Download (Excel)
        </Button>
        {state === 'offline' && (
          <span className="flex items-center gap-1.5 text-meta text-ink-2">
            <CloudOff aria-hidden className="size-4" />
            Offline: showing the last copy
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-rule py-10 text-body text-ink-2">
          {claims.length ? 'No claims here.' : 'No claims yet. Add one with New claim.'}
        </p>
      ) : (
        <ul aria-label="Claims" className="border-t border-rule">
          {shown.map((c) => (
            <li key={c.id} className="border-b border-rule">
              <button
                type="button"
                onClick={() => setOpened(c)}
                aria-label={`Claim by ${c.claimant}: ${c.purpose}`}
                className="grid w-full grid-cols-[110px_minmax(0,1fr)_120px_170px] items-center gap-x-4 py-2.5 text-left hover:bg-paper max-[800px]:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="text-meta text-ink-2 max-[800px]:hidden">{formatDay(c.date)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-body text-ink">{c.purpose}</span>
                  <span className="flex items-center gap-1.5 text-meta text-ink-2">
                    {c.claimant}
                    {c.category && <span>· {c.category}</span>}
                    {c.site && <span className="truncate">· {c.site}</span>}
                    <span className="flex items-center gap-0.5 text-ink-3">
                      <Paperclip aria-hidden className="size-3" />
                      {c.receipts.length}
                    </span>
                  </span>
                </span>
                <span className="tnum text-right text-body font-medium text-ink">
                  {money(c.amount)}
                </span>
                <span
                  className={cn(
                    'justify-self-end rounded-chip px-2 py-0.5 text-meta font-semibold max-[800px]:col-span-2 max-[800px]:justify-self-start',
                    STATUS_TONE[c.status],
                  )}
                >
                  {CLAIM_STATUS_LABEL[c.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nameDialog}
      {opened && (
        <ClaimDialog
          key={opened === 'new' ? 'new' : opened.id}
          open
          claim={opened === 'new' ? null : opened}
          admin={unlocked}
          ensureName={ensureName}
          requireAdmin={requireAdmin}
          onClose={() => setOpened(null)}
          onSaved={put}
          onDeleted={drop}
        />
      )}
    </Page>
  );
}
