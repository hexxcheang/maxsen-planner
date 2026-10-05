import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { createAnalyser } from './magic/analyse.ts';
import { createRenderer } from './sample/render.ts';
import { createAuth } from './auth.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

// Settings such as ANTHROPIC_API_KEY can live in a .env file in the project folder (never committed).
for (const file of [path.resolve(here, '../../../.env'), path.resolve(here, '../.env')]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const webDist = path.resolve(here, '../../web/dist');
const port = Number(process.env.PORT ?? 3000);
const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const render = createRenderer();

const auth = createAuth({
  passcode: process.env.PLANNER_PASSCODE,
  secret: process.env.SESSION_SECRET,
});

export const app = buildApp({ analyse: configured ? createAnalyser() : undefined, render, auth });

if (existsSync(webDist)) {
  const root = path.relative(process.cwd(), webDist);
  app.use('/*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Maxsen Smart Home Planner server listening on http://localhost:${info.port}`);
    console.log(
      configured ? 'Magic Plan: ready' : 'Magic Plan: add ANTHROPIC_API_KEY to .env to enable it',
    );
    if (auth.required) console.log('Sign-in: checked on the server (PLANNER_PASSCODE)');
    console.log(
      render
        ? `Product samples: ready (${render.provider === 'gemini' ? 'Gemini' : 'OpenAI'})`
        : 'Product samples: add GEMINI_API_KEY to .env to make pictures',
    );
  });
}
