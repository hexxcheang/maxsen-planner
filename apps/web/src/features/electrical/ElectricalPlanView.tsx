import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Download,
  FileUp,
  Maximize,
  MousePointer2,
  RotateCw,
  Search,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  countSymbols,
  DEFAULT_SYMBOL_SIZE,
  ELECTRICAL_SYMBOLS,
  newId,
  symbolById,
  type ElectricalPlan,
  type ElectricalPoint,
} from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  IconButton,
  Input,
  SegmentedControl,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/lib/files';
import { rasterizeImage, rasterizePdf } from '@/lib/images';
import { putFile } from '@/lib/storage/file-store';
import { SymbolIcon, SymbolShapes } from './symbol-draw';

const GROUPS = [...new Set(ELECTRICAL_SYMBOLS.map((s) => s.group))];
const SIZES = { S: 0.009, M: DEFAULT_SYMBOL_SIZE, L: 0.016 } as const;
type SizeKey = keyof typeof SIZES;

interface View {
  scale: number;
  x: number;
  y: number;
}

/**
 * The electrical layout: upload the floor plan, then tap symbols onto it. Each plotted point
 * counts in the quotation; the legend lists what's on the drawing.
 */
export function ElectricalPlanView({
  plan,
  onChange,
  onDownload,
}: {
  plan: ElectricalPlan | undefined;
  onChange: (plan: ElectricalPlan | undefined) => void;
  onDownload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [armed, setArmed] = useState<string | null>('light');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [making, setMaking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [history, setHistory] = useState<ElectricalPoint[][]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

  const counts = useMemo(() => countSymbols(plan?.points ?? []), [plan?.points]);
  const size = plan
    ? (plan.symbolSize ?? DEFAULT_SYMBOL_SIZE) * Math.max(plan.width, plan.height)
    : 0;

  /** Changes the points, remembering the last ones for Undo. */
  const setPoints = (points: ElectricalPoint[], remember = true) => {
    if (!plan) return;
    if (remember) setHistory((h) => [...h.slice(-49), plan.points]);
    onChange({ ...plan, points });
  };

  const fit = (p = plan) => {
    const el = box.current;
    if (!el || !p) return;
    const scale = Math.min(el.clientWidth / p.width, el.clientHeight / p.height) * 0.96;
    setView({
      scale,
      x: (el.clientWidth - p.width * scale) / 2,
      y: (el.clientHeight - p.height * scale) / 2,
    });
  };
  useEffect(() => {
    fit();
    // Fit once the drawing is there, and again when another is uploaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.fileId]);

  const zoomAt = (factor: number, cx?: number, cy?: number) =>
    setView((v) => {
      const el = box.current;
      const px = cx ?? (el ? el.clientWidth / 2 : 0);
      const py = cy ?? (el ? el.clientHeight / 2 : 0);
      const scale = Math.min(20, Math.max(0.05, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const page = isPdf ? (await rasterizePdf(file))[0] : await rasterizeImage(file);
      if (!page) throw new Error('No pages');
      const fileId = await putFile(page.blob);
      onChange({
        fileId,
        name: file.name,
        width: page.width,
        height: page.height,
        points: plan?.points ?? [],
        symbolSize: plan?.symbolSize,
      });
      setHistory([]);
    } catch (e) {
      console.error(e);
      toast({
        title: 'That drawing couldn’t be opened',
        body: 'Use a PDF, JPG or PNG.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  // --- pointer: tap to place, drag a symbol to move it, drag the drawing (or pinch) to look around
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: 'pan' | 'move' | 'pinch';
    startX: number;
    startY: number;
    moved: boolean;
    view: View;
    pointId?: string;
    origin?: { x: number; y: number };
    dist?: number;
  } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toPlan = (p: { x: number; y: number }) => ({
    x: (p.x - view.x) / view.scale,
    y: (p.y - view.y) / view.scale,
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!plan) return;
    box.current!.setPointerCapture(e.pointerId);
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        startX: (a!.x + b!.x) / 2,
        startY: (a!.y + b!.y) / 2,
        moved: true,
        view,
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
      };
      return;
    }
    const pointId = (e.target as Element).closest?.('[data-point]')?.getAttribute('data-point');
    if (pointId && !armed) {
      const p = plan.points.find((q) => q.id === pointId)!;
      setSelected(pointId);
      gesture.current = {
        kind: 'move',
        startX: at.x,
        startY: at.y,
        moved: false,
        view,
        pointId,
        origin: { x: p.x, y: p.y },
      };
    } else gesture.current = { kind: 'pan', startX: at.x, startY: at.y, moved: false, view };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !plan || !pointers.current.has(e.pointerId)) return;
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const cx = (a!.x + b!.x) / 2;
      const cy = (a!.y + b!.y) / 2;
      const scale = Math.min(20, Math.max(0.05, g.view.scale * (dist / g.dist!)));
      const k = scale / g.view.scale;
      setView({
        scale,
        x: cx - (g.startX - g.view.x) * k,
        y: cy - (g.startY - g.view.y) * k,
      });
      return;
    }
    const dx = at.x - g.startX;
    const dy = at.y - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    if (!g.moved && g.kind === 'move') setHistory((h) => [...h.slice(-49), plan.points]);
    g.moved = true;
    if (g.kind === 'pan') setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    else if (g.kind === 'move')
      setPoints(
        plan.points.map((p) =>
          p.id === g.pointId
            ? { ...p, x: g.origin!.x + dx / view.scale, y: g.origin!.y + dy / view.scale }
            : p,
        ),
        false,
      );
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g || !plan || g.moved) return;
    if (g.kind === 'pan') {
      if (armed) {
        const at = toPlan(local(e));
        if (at.x < 0 || at.y < 0 || at.x > plan.width || at.y > plan.height) return;
        const point: ElectricalPoint = { id: newId('el'), symbol: armed, x: at.x, y: at.y };
        setPoints([...plan.points, point]);
      } else setSelected(null);
    }
  };

  const remove = (id: string | null) => {
    if (!plan || !id) return;
    setPoints(plan.points.filter((p) => p.id !== id));
    setSelected(null);
  };
  const rotate = (id: string | null) => {
    if (!plan || !id) return;
    setPoints(
      plan.points.map((p) =>
        p.id === id ? { ...p, rotation: ((p.rotation ?? 0) + 90) % 360 } : p,
      ),
    );
  };
  const undo = () => {
    if (!plan || !history.length) return;
    onChange({ ...plan, points: history.at(-1)! });
    setHistory((h) => h.slice(0, -1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') {
        setArmed(null);
        setSelected(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        remove(selected);
      } else if (e.key.toLowerCase() === 'r' && selected) rotate(selected);
      else if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const q = search.trim().toLowerCase();
  const sizeKey = (Object.keys(SIZES) as SizeKey[]).find(
    (k) => SIZES[k] === (plan?.symbolSize ?? DEFAULT_SYMBOL_SIZE),
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg"
        aria-label="Floor plan drawing"
        className="sr-only"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div role="toolbar" aria-label="Plan tools" className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={plan ? 'secondary' : 'primary'}
          icon={<FileUp className="size-4" />}
          loading={loading}
          onClick={() => fileInput.current?.click()}
        >
          {plan ? 'Replace drawing' : 'Upload floor plan'}
        </Button>
        {plan && (
          <>
            <span className="mx-1 h-6 w-px bg-rule" />
            <Button
              size="sm"
              variant={armed ? 'ghost' : 'secondary'}
              icon={<MousePointer2 className="size-4" />}
              aria-pressed={!armed}
              onClick={() => setArmed(null)}
            >
              Select
            </Button>
            <IconButton
              size="sm"
              label="Undo"
              icon={<Undo2 />}
              disabled={!history.length}
              onClick={undo}
            />
            <IconButton
              size="sm"
              label="Turn selected 90°"
              icon={<RotateCw />}
              disabled={!selected}
              onClick={() => rotate(selected)}
            />
            <IconButton
              size="sm"
              label="Delete selected"
              icon={<Trash2 />}
              disabled={!selected}
              onClick={() => remove(selected)}
            />
            <span className="mx-1 h-6 w-px bg-rule" />
            <IconButton
              size="sm"
              label="Zoom out"
              icon={<ZoomOut />}
              onClick={() => zoomAt(1 / 1.25)}
            />
            <IconButton size="sm" label="Zoom in" icon={<ZoomIn />} onClick={() => zoomAt(1.25)} />
            <IconButton size="sm" label="Fit drawing" icon={<Maximize />} onClick={() => fit()} />
            <SegmentedControl<SizeKey>
              size="sm"
              label="Symbol size"
              value={sizeKey ?? 'M'}
              options={[
                { value: 'S', label: 'S' },
                { value: 'M', label: 'M' },
                { value: 'L', label: 'L' },
              ]}
              onChange={(k) => onChange({ ...plan, symbolSize: SIZES[k] })}
            />
            <span className="ml-auto" />
            {plan.points.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setClearing(true)}>
                Clear points
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              icon={<Download className="size-4" />}
              loading={making}
              onClick={async () => {
                setMaking(true);
                try {
                  await onDownload();
                } finally {
                  setMaking(false);
                }
              }}
            >
              Download plan (PDF)
            </Button>
          </>
        )}
      </div>

      <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)_220px] gap-3 max-[1100px]:grid-cols-[200px_minmax(0,1fr)]">
        <aside
          aria-label="Symbols"
          className="flex max-h-[72dvh] flex-col gap-2 overflow-y-auto pr-1"
        >
          <Input
            type="search"
            compact
            aria-label="Search symbols"
            leading={<Search />}
            placeholder="Socket, switch, isolator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {GROUPS.map((group) => {
            const shown = ELECTRICAL_SYMBOLS.filter(
              (s) => s.group === group && (!q || s.name.toLowerCase().includes(q)),
            );
            if (!shown.length) return null;
            return (
              <section key={group} aria-label={group}>
                <h3 className="mb-1 text-meta font-semibold text-ink-2">{group}</h3>
                <ul className="flex flex-col gap-0.5">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-pressed={armed === s.id}
                        onClick={() => {
                          setArmed(armed === s.id ? null : s.id);
                          setSelected(null);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-control',
                          armed === s.id
                            ? 'bg-ink text-surface [&_svg]:text-surface'
                            : 'text-ink hover:bg-paper',
                        )}
                      >
                        <SymbolIcon symbol={s} size={26} />
                        <span className="min-w-0 flex-1 leading-tight">{s.name}</span>
                        {counts[s.id] ? (
                          <span className="tnum text-meta opacity-80">{counts[s.id]}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </aside>

        <div
          ref={box}
          data-testid="electrical-canvas"
          className={cn(
            'relative h-[72dvh] touch-none overflow-hidden rounded-md border border-rule bg-desk select-none',
            plan && armed ? 'cursor-crosshair' : 'cursor-grab',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => {
            if (!plan) return;
            const at = local(e);
            zoomAt(Math.exp(-e.deltaY * 0.0015), at.x, at.y);
          }}
        >
          {plan ? (
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: plan.width,
                height: plan.height,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              }}
            >
              <img
                src={fileUrl(plan.fileId)}
                alt={`Floor plan: ${plan.name}`}
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full bg-white"
              />
              <svg
                className="absolute inset-0 size-full overflow-visible"
                viewBox={`0 0 ${plan.width} ${plan.height}`}
              >
                {plan.points.map((p) => {
                  const symbol = symbolById(p.symbol);
                  if (!symbol) return null;
                  const on = p.id === selected;
                  return (
                    <g
                      key={p.id}
                      data-point={p.id}
                      aria-label={symbol.name}
                      role="img"
                      transform={`translate(${p.x} ${p.y}) rotate(${p.rotation ?? 0}) scale(${size})`}
                      className={armed ? '' : 'cursor-move'}
                    >
                      {/* A wider invisible target, easy to tap. */}
                      <circle r={1.6} fill="transparent" />
                      {on && (
                        <circle
                          r={1.55}
                          fill="rgb(197 138 98 / 0.18)"
                          stroke="#c58a62"
                          strokeWidth={0.08}
                        />
                      )}
                      <SymbolShapes symbol={symbol} color="#1a4fd6" />
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-sm text-control text-ink-2">
                Upload the floor plan (PDF, JPG or PNG), then pick a symbol on the left and tap the
                drawing to place it. Each point counts in the quotation.
              </p>
              <Button
                variant="primary"
                icon={<FileUp className="size-4" />}
                loading={loading}
                onClick={() => fileInput.current?.click()}
              >
                Upload floor plan
              </Button>
            </div>
          )}
          {plan && (
            <p className="pointer-events-none absolute bottom-2 left-2 rounded-chip bg-surface/90 px-2 py-1 text-meta text-ink-2 shadow-sm">
              {armed
                ? `Tap the drawing to place: ${symbolById(armed)?.name}. Esc or Select to stop.`
                : 'Tap a symbol to select it; drag to move. Drag the drawing to look around.'}
            </p>
          )}
        </div>

        <aside
          aria-label="Legend"
          className="flex max-h-[72dvh] flex-col gap-1 overflow-y-auto max-[1100px]:col-span-2"
        >
          <h3 className="border-b border-rule pb-1 text-control font-semibold text-ink">Legend</h3>
          {Object.keys(counts).length === 0 ? (
            <p className="text-meta text-ink-3">Nothing plotted yet.</p>
          ) : (
            <ul className="flex flex-col" data-testid="electrical-legend">
              {ELECTRICAL_SYMBOLS.filter((s) => counts[s.id]).map((s) => (
                <li key={s.id} className="flex items-center gap-2 border-b border-rule py-1">
                  <SymbolIcon symbol={s} size={22} />
                  <span className="min-w-0 flex-1 text-meta leading-tight text-ink">
                    {s.name}
                    {!s.rateId && <span className="block text-ink-3">Drawing only</span>}
                  </span>
                  <span className="tnum text-control font-semibold text-ink">{counts[s.id]}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={clearing}
        title="Clear every point?"
        body="The drawing stays; every plotted point is taken off (Undo brings them back)."
        confirmLabel="Clear points"
        destructive
        onCancel={() => setClearing(false)}
        onConfirm={() => {
          setPoints([]);
          setClearing(false);
        }}
      />
    </div>
  );
}
