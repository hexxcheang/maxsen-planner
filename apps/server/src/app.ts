import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import { AnalysisError, type Analyser } from './magic/analyse.ts';
import { RenderError, type Renderer } from './sample/render.ts';
import { createAuth, type Auth } from './auth.ts';
import { ID, type SharedStore } from './shared/store.ts';
import { eventBody, type TimetableStore } from './timetable.ts';
import { MANAGER_KINDS, movementBody, verifyBody, type InventoryStore } from './inventory.ts';
import { leadBody, noteBody, type LeadStore } from './leads.ts';

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
  persistent = true,
}: {
  leads?: LeadStore;
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

  app.use('/api/*', auth.guard());

  /** Whether the server checks the passcode (online), and whether this browser is signed in. */
  app.get('/api/auth/status', (c) =>
    c.json({ required: auth.required, signedIn: auth.signedIn(c), admin: auth.isAdmin(c) }),
  );
  /** Admin is unlocked on the server, so only the admin can change what everyone shares. */
  app.post('/api/auth/admin', async (c) => {
    if (!auth.signedIn(c)) return c.json({ ok: false }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: unknown };
    const ok = auth.unlockAdmin(c, typeof body.passcode === 'string' ? body.passcode : '');
    return c.json({ ok }, ok ? 200 : 401);
  });
  app.post('/api/auth/admin/lock', (c) => {
    auth.lockAdmin(c);
    return c.json({ ok: true });
  });
  app.post('/api/auth/sign-in', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: unknown };
    const ok = auth.signIn(c, typeof body.passcode === 'string' ? body.passcode : '');
    return c.json({ ok, required: auth.required }, ok ? 200 : 401);
  });
  app.post('/api/auth/sign-out', (c) => {
    auth.signOut(c);
    return c.json({ ok: true });
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
    return c.body(new Uint8Array(file.data), 200, {
      'content-type': file.type,
      'cache-control': 'private, max-age=31536000, immutable',
    });
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
  app.get('/api/timetable', async (c) =>
    timetable ? c.json(await timetable.read()) : c.json({ error: 'not-configured' }, 503),
  );
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
    return c.json({ event: await timetable!.put(id, body.data, by) });
  });
  app.delete('/api/timetable/events/:id', async (c) =>
    auth.isAdmin(c)
      ? c.json({ removed: await timetable!.remove(c.req.param('id')) })
      : c.json(notAdmin, 403),
  );
  app.put('/api/timetable/people', async (c) => {
    if (!auth.isAdmin(c)) return c.json(notAdmin, 403);
    const body = z
      .object({ people: z.array(z.string().trim().min(1).max(60)).max(100) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ people: await timetable!.setPeople(body.data.people) });
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
    leads ? c.json({ leads: await leads.read() }) : c.json(noLeads, 503),
  );
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
