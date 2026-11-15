/**
 * A tiny OpenAI-compatible server for the demo: no API key, no network, and
 * the same answers every run. It also serves the demo web page and records
 * what the extension sent, so the recording script can assert on it.
 *
 *   GET  /                      demo article page
 *   GET  /v1/models             model list
 *   POST /v1/chat/completions   streaming (SSE) or plain JSON
 *   GET  /__requests            what the extension sent (for assertions)
 */
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { ANSWERS } from './fixtures.mjs';
import { renderSite } from './site.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Decide which canned answer fits, from the system prompt LinguaAssist sends. */
function pickAnswer(system, user) {
  if (system.includes('patient language tutor')) return { kind: 'explain', text: ANSWERS.explain };
  if (system.includes('Fix the grammar')) {
    return { kind: 'fixGrammar', text: ANSWERS.fixGrammar.get(user.trim()) ?? user };
  }
  if (system.includes('content analyst')) return { kind: 'summary', text: ANSWERS.summary };
  if (system.includes('expert professional translator') || system.includes('bilingual dictionary')) {
    if (/break the ice/i.test(user)) return { kind: 'term', text: ANSWERS.term };
    return { kind: /release notes/i.test(user) ? 'manual' : 'translate', text: /release notes/i.test(user) ? ANSWERS.manual : ANSWERS.translate };
  }
  return { kind: 'other', text: 'This is a demo answer.' };
}

export async function startMockServer() {
  const captured = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(renderSite());
      return;
    }
    if (url.pathname === '/v1/models') {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'demo-model' }, { id: 'demo-model-large' }] }));
      return;
    }
    if (url.pathname === '/__requests') {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(captured));
      return;
    }
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
      const user = body.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
      const answer = pickAnswer(system, user);
      captured.push({ kind: answer.kind, system, user, stream: !!body.stream });

      if (!body.stream) {
        res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: answer.text } }] }));
        return;
      }

      res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      await sleep(500); // a believable "Thinking…" moment
      const chars = [...answer.text];
      for (let i = 0; i < chars.length; i += 3) {
        if (res.destroyed) return;
        const delta = { choices: [{ delta: { content: chars.slice(i, i + 3).join('') } }] };
        res.write(`data: ${JSON.stringify(delta)}\n\n`);
        await sleep(28);
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.writeHead(404, CORS).end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, port, origin: `http://127.0.0.1:${port}`, captured };
}

// `npm run mock` — handy for recording by hand against the same fake AI.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { origin } = await startMockServer();
  console.log(`Mock LLM + demo page: ${origin}\nSet Base URL to ${origin}/v1 (any model name, any key).`);
}
