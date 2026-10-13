import { useCallback, useEffect, useState } from 'react';
import { newId, type Claim } from '@maxsen/domain';
import { savedByName } from '@/lib/shared/api';

const CACHE = 'maxsen.claims.cache';

export class ClaimError extends Error {
  constructor(
    message: string,
    readonly needsAdmin = false,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-maxsen-name': encodeURIComponent(savedByName()).slice(0, 80),
        ...init?.headers,
      },
    });
  } catch {
    throw new ClaimError('The team server can’t be reached. Check the connection.');
  }
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (res.status === 403) throw new ClaimError(body?.message ?? 'Admin only.', true);
  if (!res.ok || !body) throw new ClaimError(body?.message ?? 'That didn’t go through.');
  return body;
}

export type ClaimInput = Pick<Claim, 'date' | 'amount' | 'purpose' | 'receipts'> &
  Partial<Pick<Claim, 'category' | 'site'>>;

export const saveClaim = (id: string, input: ClaimInput) =>
  call<{ claim: Claim }>(`/api/claims/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(
    (r) => r.claim,
  );

export const decideClaim = (id: string, status: 'approved' | 'rejected', note?: string) =>
  call<{ claim: Claim }>(`/api/claims/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  }).then((r) => r.claim);

export const deleteClaim = (id: string) =>
  call<{ removed: boolean }>(`/api/claims/${id}`, { method: 'DELETE' });

export const receiptUrl = (id: string) => `/api/claims/receipts/${id}`;

/** A photo shrunk to a sharp but light JPEG (a phone's HEIC included); PDFs go as they are. */
async function prepare(file: File): Promise<Blob> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new ClaimError('That picture couldn’t be opened.'));
      i.src = url;
    });
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new ClaimError('That picture couldn’t be saved.'))),
        'image/jpeg',
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Puts a receipt on the team server; what the claim keeps to show it. */
export async function uploadReceipt(file: File): Promise<Claim['receipts'][number]> {
  const blob = await prepare(file);
  const id = newId('rcpt');
  const res = await fetch(receiptUrl(id), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': blob.type || 'application/pdf' },
    body: blob,
  }).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    throw new ClaimError(body?.message ?? 'The receipt couldn’t be uploaded.');
  }
  return { id, name: file.name, type: blob.type || 'application/pdf' };
}

function cached(): Claim[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Claim[]) : null;
  } catch {
    return null;
  }
}

/**
 * The team's claims: fetched on opening, every 30 seconds in view, and after each change. The
 * last copy stays on the device, to show without a connection.
 */
export function useClaims() {
  const [claims, setClaims] = useState<Claim[] | null>(cached);
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'unavailable'>('loading');
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/claims', { credentials: 'same-origin' });
      if (res.status === 503 || res.status === 404) return setState('unavailable');
      if (!res.ok) throw new Error(String(res.status));
      const next = ((await res.json()) as { claims: Claim[] }).claims;
      setClaims(next);
      setState('live');
      try {
        window.localStorage.setItem(CACHE, JSON.stringify(next));
      } catch {
        // Shown live only.
      }
    } catch {
      setState(cached() ? 'offline' : 'unavailable');
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [refresh]);
  /** Puts a saved claim in the list at once, without waiting for the next fetch. */
  const put = (claim: Claim) =>
    setClaims((cs) => [...(cs ?? []).filter((c) => c.id !== claim.id), claim]);
  const drop = (id: string) => setClaims((cs) => (cs ?? []).filter((c) => c.id !== id));
  return { claims: claims ?? [], state, refresh, put, drop };
}
