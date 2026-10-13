import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import { AnalysisError, type Analyser } from './magic/analyse.ts';
import { RenderError, type Renderer } from './sample/render.ts';
import { createAuth, type Auth } from './auth.ts';
import { ID, type SharedStore } from './shared/store.ts';
import { eventBody, timetableCopy, type TimetableStore } from './timetable.ts';
import { MANAGER_KINDS, movementBody, verifyBody, type InventoryStore } from './inventory.ts';
import { leadBody, leadsCopy, noteBody, type LeadStore } from './leads.ts';
import { memberBody, teamCopy, type TeamStore } from './team.ts';
import { createLive, topicOf } from './live.ts';
import {
  claimBody,
  decisionBody,
  MAX_RECEIPT_BYTES,
  RECEIPT_ID,
  RECEIPT_TYPES,
  type ClaimStore,
} from './claims.ts';
import { createAttemptLimit, fileHeaders, headers, sameSiteOnly } from './security.ts';
import { MAX_PDF_BYTES, pdfText } from './pdf-text.ts';

const analyseBody = z.object({
  image: z.string().min(100).max(15_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg']),
  notes: z.string().max(2000).optional(),
});

const renderBody = z.object({
  image: z.string().min(100).max(15_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  prompt: z.string().min(10).max(4000),
});

const saveBody = z.object({
  baseVersion: z.number().int().min(0),
  savedBy: z.string().trim().min(1).max(80),
  force: z.boolean().optional(),
  bundle: z
    .object({
      project: z
        .object({
          id: z.string(),
          title: z.string(),
          customerName: z.string().default(''),
          propertyAddress: z.string().default(''),
          status: z.string().default('draft'),
        })
        .passthrough(),
    })
    .passthrough(),
});

const workspaceBody = z.object({
  baseVersion: z.number().int().min(0),
  savedBy: z.string().trim().min(1).max(80),
  force: z.boolean().optional(),
  workspace: z
    .object({
      products: z.array(z.unknown()),
      variants: z.array(z.unknown()),
      settings: z.object({}).passthrough(),
      templates: z.array(z.unknown()),
    })
    .passthrough(),
});

/** Drawings are rasterised pages and PDFs; anything bigger is refused. */
const MAX_FILE_BYTES = 60 * 1024 * 1024;

const RENDER_STATUS = { auth: 502, busy: 429, refused: 422, upstream: 502 } as const;

/**
 * The API. `analyse` is absent when no Anthropic credentials are configured, `render` when no
 * image model key is.
 */
export function buildApp({
  analyse,
  render,
  auth = createAuth({}),
  shared,
  timetable,
  inventory,
  leads,
  claims,
  team,
  persistent = true,
}: {
  leads?: LeadStore;
  claims?: ClaimStore;
  team?: TeamStore;
  timetable?: TimetableStore;
  inventory?: InventoryStore;
  analyse?: Analyser;
  render?: Renderer;
  auth?: Auth;
  shared?: SharedStore;
  /** Whether the team's saves survive a redeploy (on Render: kept on a disk). */
  persistent?: boolean;
} = {}) {
  const app = new Hono();
  const attempts = createAttemptLimit();

  app.use('*', headers());
  app.use('/api/*', sameSiteOnly());
  app.use('/api/*', auth.guard());

  // --- live: open copies of the app hear at once that something shared changed ----------------
  const live = createLive();
  app.use('/api/*', async (c, next) => {
    await next();
    const topic = c.req.method === 'GET' || !c.res.ok ? null : topicOf(c.req.path);
    if (topic) live.publish(topic);
  });
  app.get('/api/live', (c) => live.stream(c));

  /** Too many wrong passcodes from one place: a pause before the next try. */
  const tooMany = (c: Parameters<typeof auth.signIn>[0]) => {
    const wait = attempts.blocked(c);
    return wait
      ? c.json(
          {
            ok: false,
            error: 'too-many',
            message: `Too many wrong passcodes. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`,
          },
          429,
        )
      : null;
  };

  /** Whether the server checks the passcode (online), and whether this browser is signed in. */
  app.get('/api/auth/status', (c) =>
    c.json({ required: auth.required, signedIn: auth.signedIn(c), admin: auth.isAdmin(c) }),
  );
  /** Admin is unlocked on the server, so only the admin can change what everyone shares. */
  app.post('/api/auth/admin', async (c) => {
    if (!auth.signedIn(c)) return c.json({ ok: false }, 401);
    const blocked = tooMany(c);
    if (blocked) return blocked;
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: unknown };
    const ok = auth.unlockAdmin(c, typeof body.passcode === 'string' ? body.passcode : '');
    if (ok) attempts.succeeded(c);
    else attempts.failed(c);
    return c.json({ ok }, ok ? 200 : 401);
  });
  app.post('/api/auth/admin/lock', (c) => {
    auth.lockAdmin(c);
    return c.json({ ok: true });
  });
  app.post('/api/auth/sign-in', async (c) => {
    const blocked = tooMany(c);
    if (blocked) return blocked;
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: unknown };
    const ok = auth.signIn(c, typeof body.passcode === 'string' ? body.passcode : '');
    if (ok) attempts.succeeded(c);
    else if (auth.required) attempts.failed(c);
    return c.json({ ok, required: auth.required }, ok ? 200 : 401);
  });
  app.post('/api/auth/sign-out', (c) => {
    auth.signOut(c);
    return c.json({ ok: true });
  });

  /** An old invoice's text, read here when the browser can't read the PDF itself. */
  app.post('/api/pdf/text', async (c) => {
    const data = new Uint8Array(await c.req.arrayBuffer());
    if (data.byteLength > MAX_PDF_BYTES) return c.json({ error: 'too-large' }, 413);
    if (String.fromCharCode(...data.subarray(0, 5)) !== '%PDF-')
      return c.json({ error: 'bad-request', message: 'That isn’t a PDF.' }, 400);
    try {
      return c.json({ texts: await pdfText(data) });
    } catch (e) {
      console.error('PDF text failed', e);
      return c.json({ error: 'unreadable', message: 'The PDF couldn’t be opened.' }, 422);
    }
  });

  app.get('/api/product-sample/status', (c) =>
    c.json({ configured: Boolean(render), provider: render?.provider ?? null }),
  );

  app.post('/api/product-sample/render', async (c) => {
    if (!render) {
      return c.json(
        {
          error: 'not-configured',
          message: 'Product samples need an image model key (GEMINI_API_KEY) on the server.',
        },
        503,
      );
    }
    const body = renderBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json({ error: 'bad-request', message: 'Send a JPEG or PNG product photo.' }, 400);
    try {
      return c.json(await render.render(body.data));
    } catch (e) {
      if (e instanceof RenderError)
        return c.json({ error: e.code, message: e.message }, RENDER_STATUS[e.code]);
      console.error('Product sample failed', e);
      return c.json(
        { error: 'upstream', message: 'The picture couldn’t be made. Try again shortly.' },
        502,
      );
    }
  });

  // --- projects saved for the team -----------------------------------------------------------
  app.get('/api/shared/status', (c) =>
    c.json({ enabled: Boolean(shared), persistent: shared ? persistent : false }),
  );

  app.use('/api/shared/*', async (c, next) => {
    if (c.req.path === '/api/shared/status') return next();
    if (!shared)
      return c.json(
        { error: 'not-configured', message: 'Team saving is off on this server.' },
        503,
      );
    return next();
  });

  // The list also says which version of the shared catalogue and settings is current, so devices
  // only fetch those when they've changed.
  app.get('/api/shared/projects', async (c) =>
    c.json({
      projects: await shared!.list(),
      workspace: (await shared!.getWorkspace())?.meta ?? null,
    }),
  );

  app.get('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    const found = ID.test(id) ? await shared!.get(id) : null;
    return found ? c.json(found) : c.json({ error: 'not-found' }, 404);
  });

  app.put('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    const body = saveBody.safeParse(await c.req.json().catch(() => null));
    if (!ID.test(id) || !body.success || body.data.bundle.project.id !== id)
      return c.json({ error: 'bad-request', message: 'That project couldn’t be read.' }, 400);
    const { title, customerName, propertyAddress, status } = body.data.bundle.project;
    const result = await shared!.save(id, body.data, {
      title,
      customerName,
      propertyAddress,
      status,
    });
    return result.ok
      ? c.json({ meta: result.meta })
      : c.json({ error: 'conflict', meta: result.conflict }, 409);
  });

  app.delete('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    if (!ID.test(id)) return c.json({ error: 'bad-request' }, 400);
    return c.json({ removed: await shared!.remove(id) });
  });

  app.get('/api/shared/workspace', async (c) => {
    const found = await shared!.getWorkspace();
    return found ? c.json(found) : c.json({ error: 'not-found' }, 404);
  });

  app.put('/api/shared/workspace', async (c) => {
    const body = workspaceBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    const result = await shared!.saveWorkspace(body.data);
    return result.ok
      ? c.json({ meta: result.meta })
      : c.json({ error: 'conflict', meta: result.conflict }, 409);
  });

  app.post('/api/shared/files/missing', async (c) => {
    const body = z
      .object({ ids: z.array(z.string()).max(5000) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ missing: await shared!.missingFiles(body.data.ids) });
  });

  app.put('/api/shared/files/:id', async (c) => {
    const id = c.req.param('id');
    if (!ID.test(id)) return c.json({ error: 'bad-request' }, 400);
    const data = new Uint8Array(await c.req.arrayBuffer());
    if (data.byteLength > MAX_FILE_BYTES) return c.json({ error: 'too-large' }, 413);
    await shared!.putFile(id, data, c.req.header('content-type') ?? '');
    return c.json({ ok: true });
  });

  app.get('/api/shared/files/:id', async (c) => {
    const id = c.req.param('id');
    const file = ID.test(id) ? await shared!.getFile(id) : null;
    if (!file) return c.json({ error: 'not-found' }, 404);
    return c.body(new Uint8Array(file.data), 200, fileHeaders(file.type));
  });

  // --- the team timetable: everyone reads it, the admin schedules it ----------------------------
  app.use('/api/timetable/*', async (c, next) => {
    if (!timetable)
      return c.json(
        { error: 'not-configured', message: 'The timetable needs the team server.' },
        503,
      );
    return next();
  });
  const notAdmin = {
    error: 'admin',
    message: 'Only the admin can change the timetable. Unlock admin first.',
  };
  app.get('/api/timetable', async (c) => {
    if (!timetable) return c.json({ error: 'not-configured' }, 503);
    // `fresh`: the server has no timetable (new, or it lost its data); a device can put back its copy.
    const data = { ...(await timetable.read()), fresh: !(await timetable.exists()) };
    if (!team) return c.json(data);
    // The people to assign, and their numbers, come from the Team tab: active members only.
    const members = (await team.read()).filter((m) => m.active);
    return c.json({
      ...data,
      people: members.map((m) => m.name).sort((a, b) => a.localeCompare(b)),
      phones: Object.fromEntries(members.flatMap((m) => (m.phone ? [[m.name, m.phone]] : []))),
    });
  });
  /** After the server lost its data: a device's last copy, accepted only into an empty timetable. */
  app.post('/api/timetable/restore', async (c) => {
    const body = timetableCopy.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ restored: await timetable!.restore(body.data) });
  });
  app.put('/api/timetable/events/:id', async (c) => {
    if (!auth.isAdmin(c)) return c.json(notAdmin, 403);
    const id = c.req.param('id');
    const body = eventBody.safeParse(await c.req.json().catch(() => null));
    if (!/^[a-z]+_[A-Za-z0-9]{4,40}$/.test(id) || !body.success)
      return c.json(
        { error: 'bad-request', message: body.error?.issues[0]?.message ?? 'Check the details.' },
        400,
      );
    let by = 'Admin';
    try {
      by = decodeURIComponent(c.req.header('x-maxsen-name') ?? '').slice(0, 80) || by;
    } catch {
      // A garbled name: shown as "Admin".
    }
    const event = await timetable!.put(id, body.data, by);
    // Someone assigned who isn't on the team yet joins it.
    await team?.ensure(body.data.people, by);
    return c.json({ event });
  });
  app.delete('/api/timetable/events/:id', async (c) =>
    auth.isAdmin(c)
      ? c.json({ removed: await timetable!.remove(c.req.param('id')) })
      : c.json(notAdmin, 403),
  );
  app.put('/api/timetable/people', async (c) => {
    if (!auth.isAdmin(c)) return c.json(notAdmin, 403);
    const body = z
      .object({
        people: z.array(z.string().trim().min(1).max(60)).max(100),
        phones: z.record(z.string(), z.string().trim().max(30)).optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json(await timetable!.setPeople(body.data.people, body.data.phones));
  });
  app.put('/api/timetable/settings', async (c) => {
    if (!auth.isAdmin(c)) return c.json(notAdmin, 403);
    const body = z.object({ notify: z.boolean() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ notify: await timetable!.setNotify(body.data.notify) });
  });

  // --- inventory: installers take out and return; the inventory manager (admin) restocks, -------
  // --- corrects counts and checks each site's take-out ------------------------------------------
  const nameOf = (c: { req: { header: (n: string) => string | undefined } }) => {
    try {
      return decodeURIComponent(c.req.header('x-maxsen-name') ?? '').slice(0, 80) || 'Someone';
    } catch {
      return 'Someone';
    }
  };
  const managerOnly = {
    error: 'admin',
    message: 'Only the inventory manager can do this. Unlock admin first.',
  };
  const noInventory = { error: 'not-configured', message: 'Inventory needs the team server.' };
  app.get('/api/inventory', async (c) =>
    inventory ? c.json(await inventory.read()) : c.json(noInventory, 503),
  );
  app.post('/api/inventory/movements', async (c) => {
    if (!inventory) return c.json(noInventory, 503);
    const body = movementBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json(
        { error: 'bad-request', message: body.error.issues[0]?.message ?? 'Check the items.' },
        400,
      );
    if (MANAGER_KINDS.has(body.data.kind) && !auth.isAdmin(c)) return c.json(managerOnly, 403);
    return c.json({ movement: await inventory.add(body.data, nameOf(c)) });
  });
  app.post('/api/inventory/movements/:id/verify', async (c) => {
    if (!inventory) return c.json(noInventory, 503);
    if (!auth.isAdmin(c)) return c.json(managerOnly, 403);
    const body = verifyBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    const m = await inventory.verify(
      c.req.param('id'),
      body.data.counts,
      nameOf(c),
      body.data.note,
    );
    return m ? c.json({ movement: m }) : c.json({ error: 'not-found' }, 404);
  });
  app.delete('/api/inventory/movements/:id', async (c) => {
    if (!inventory) return c.json(noInventory, 503);
    if (!auth.isAdmin(c)) return c.json(managerOnly, 403);
    return c.json({ removed: await inventory.remove(c.req.param('id')) });
  });
  app.put('/api/inventory/minimums', async (c) => {
    if (!inventory) return c.json(noInventory, 503);
    if (!auth.isAdmin(c)) return c.json(managerOnly, 403);
    const body = z
      .record(z.string(), z.number().finite().min(0))
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ minimums: await inventory.setMinimums(body.data) });
  });

  // --- leads: everyone adds and updates them; the admin deletes ---------------------------------
  const noLeads = { error: 'not-configured', message: 'Leads need the team server.' };
  app.get('/api/leads', async (c) =>
    leads
      ? c.json({ leads: await leads.read(), fresh: !(await leads.exists()) })
      : c.json(noLeads, 503),
  );
  app.post('/api/leads/restore', async (c) => {
    if (!leads) return c.json(noLeads, 503);
    const body = leadsCopy.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ restored: await leads.restore(body.data) });
  });
  app.put('/api/leads/:id', async (c) => {
    if (!leads) return c.json(noLeads, 503);
    const id = c.req.param('id');
    const body = leadBody.safeParse(await c.req.json().catch(() => null));
    if (!ID.test(id) || !body.success)
      return c.json(
        { error: 'bad-request', message: body.error?.issues[0]?.message ?? 'Check the details.' },
        400,
      );
    const result = await leads.save(id, body.data, nameOf(c));
    return result.ok
      ? c.json({ lead: result.lead })
      : c.json(
          {
            error: 'conflict',
            message: `${result.current.updatedBy} changed this lead while you were editing it.`,
            lead: result.current,
          },
          409,
        );
  });
  app.post('/api/leads/:id/notes', async (c) => {
    if (!leads) return c.json(noLeads, 503);
    const body = noteBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    const lead = await leads.addNote(c.req.param('id'), body.data.text, nameOf(c));
    return lead ? c.json({ lead }) : c.json({ error: 'not-found' }, 404);
  });
  app.delete('/api/leads/:id', async (c) => {
    if (!leads) return c.json(noLeads, 503);
    if (!auth.isAdmin(c))
      return c.json(
        { error: 'admin', message: 'Only the admin can delete a lead; mark it Lost instead.' },
        403,
      );
    return c.json({ removed: await leads.remove(c.req.param('id')) });
  });

  // --- claims: everyone claims with receipts; the admin approves or rejects ----------------------
  const noClaims = { error: 'not-configured', message: 'Claims need the team server.' };
  app.get('/api/claims', async (c) =>
    claims ? c.json({ claims: await claims.read() }) : c.json(noClaims, 503),
  );
  app.put('/api/claims/:id', async (c) => {
    if (!claims) return c.json(noClaims, 503);
    const id = c.req.param('id');
    const body = claimBody.safeParse(await c.req.json().catch(() => null));
    if (!ID.test(id) || !body.success)
      return c.json(
        {
          error: 'bad-request',
          message: body.success
            ? 'Check the details.'
            : body.error.issues[0]?.path[0] === 'receipts'
              ? 'Add a picture or PDF of the receipt.'
              : 'Fill in the date, amount and what it was for.',
        },
        400,
      );
    const result = await claims.save(id, body.data, nameOf(c));
    if (result.ok) return c.json({ claim: result.claim });
    return result.reason === 'decided'
      ? c.json(
          {
            error: 'decided',
            message: 'This claim has been decided already.',
            claim: result.current,
          },
          409,
        )
      : c.json({ error: 'not-found' }, 404);
  });
  app.post('/api/claims/:id/decision', async (c) => {
    if (!claims) return c.json(noClaims, 503);
    if (!auth.isAdmin(c))
      return c.json(
        { error: 'admin', message: 'Only the admin can approve or reject a claim.' },
        403,
      );
    const body = decisionBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    if (body.data.status === 'rejected' && !body.data.note)
      return c.json({ error: 'bad-request', message: 'Say why it’s rejected.' }, 400);
    const claim = await claims.decide(
      c.req.param('id'),
      body.data.status,
      nameOf(c),
      body.data.note,
    );
    return claim ? c.json({ claim }) : c.json({ error: 'not-found' }, 404);
  });
  app.delete('/api/claims/:id', async (c) => {
    if (!claims) return c.json(noClaims, 503);
    const result = await claims.remove(c.req.param('id'), auth.isAdmin(c));
    if (result === 'decided')
      return c.json(
        { error: 'decided', message: 'Only the admin can remove a claim once it’s decided.' },
        403,
      );
    return c.json({ removed: result === 'removed' });
  });
  app.put('/api/claims/receipts/:id', async (c) => {
    if (!claims) return c.json(noClaims, 503);
    const id = c.req.param('id');
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim();
    if (!RECEIPT_ID.test(id) || !RECEIPT_TYPES.test(type))
      return c.json({ error: 'bad-request', message: 'Receipts are photos or PDFs.' }, 400);
    const data = new Uint8Array(await c.req.arrayBuffer());
    if (data.byteLength > MAX_RECEIPT_BYTES)
      return c.json(
        { error: 'too-large', message: 'That receipt is too big (15 MB at most).' },
        413,
      );
    await claims.putReceipt(id, data, type);
    return c.json({ ok: true });
  });
  app.get('/api/claims/receipts/:id', async (c) => {
    if (!claims) return c.json(noClaims, 503);
    const id = c.req.param('id');
    const file = RECEIPT_ID.test(id) ? await claims.getReceipt(id) : null;
    if (!file) return c.json({ error: 'not-found' }, 404);
    return c.body(new Uint8Array(file.data), 200, fileHeaders(file.type));
  });

  // --- the team: everyone signed in sees it; the admin keeps it ----------------------------------
  const noTeam = { error: 'not-configured', message: 'The team list needs the team server.' };
  app.get('/api/team', async (c) =>
    team ? c.json({ members: await team.read(), fresh: await team.fresh() }) : c.json(noTeam, 503),
  );
  app.post('/api/team/restore', async (c) => {
    if (!team) return c.json(noTeam, 503);
    const body = teamCopy.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ restored: await team.restore(body.data) });
  });
  app.put('/api/team/:id', async (c) => {
    if (!team) return c.json(noTeam, 503);
    if (!auth.isAdmin(c))
      return c.json({ error: 'admin', message: 'Only the admin can change the team.' }, 403);
    const id = c.req.param('id');
    const body = memberBody.safeParse(await c.req.json().catch(() => null));
    if (!ID.test(id) || !body.success)
      return c.json({ error: 'bad-request', message: 'Check the name and details.' }, 400);
    const result = await team.save(id, body.data, nameOf(c));
    return result.ok
      ? c.json({ member: result.member })
      : c.json({ error: 'duplicate', message: result.message }, 409);
  });
  app.delete('/api/team/:id', async (c) => {
    if (!team) return c.json(noTeam, 503);
    if (!auth.isAdmin(c))
      return c.json({ error: 'admin', message: 'Only the admin can change the team.' }, 403);
    return c.json({ removed: await team.remove(c.req.param('id')) });
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/magic-plan/status', (c) => c.json({ configured: Boolean(analyse) }));

  app.post('/api/magic-plan/analyse', async (c) => {
    if (!analyse) {
      return c.json(
        {
          error: 'not-configured',
          message: 'Magic Plan needs an Anthropic API key on the server.',
        },
        503,
      );
    }
    const body = analyseBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json({ error: 'bad-request', message: 'Send a PNG or JPEG drawing.' }, 400);
    try {
      return c.json({ analysis: await analyse(body.data) });
    } catch (e) {
      if (e instanceof AnalysisError)
        return c.json({ error: 'unreadable', message: e.message }, 422);
      if (e instanceof Anthropic.AuthenticationError) {
        return c.json(
          {
            error: 'auth',
            message: 'The Anthropic API key was rejected. Check it and restart the app.',
          },
          502,
        );
      }
      if (e instanceof Anthropic.RateLimitError) {
        return c.json(
          { error: 'busy', message: 'Too many requests right now. Wait a minute and try again.' },
          429,
        );
      }
      if (e instanceof Anthropic.APIError) {
        console.error('Magic Plan analysis failed', e.status, e.message);
        return c.json(
          { error: 'upstream', message: 'The drawing service is unavailable. Try again shortly.' },
          502,
        );
      }
      throw e;
    }
  });

  return app;
}
