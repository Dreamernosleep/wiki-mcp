#!/usr/bin/env node
/**
 * Wiki MCP interactive setup
 *
 *   npm run setup            interactive
 *   npm run setup -- --yes   accept all defaults, no prompts (CI / scripts)
 *   npm run setup -- --no-start   configure only, do not start Docker
 *
 * What it does:
 *   1. Checks Node >= 22 and that Docker (with Compose) is installed and running
 *   2. Creates .env from .env.example if it does not exist (never overwrites)
 *   3. Generates a random MEILISEARCH_KEY if the current one is the placeholder
 *   4. Asks for the API and UI ports (defaults 3000 / 80)
 *   5. Starts the stack with Docker Compose, waits for the API to be healthy,
 *      and prints the URLs plus a ready-to-paste MCP config block
 *
 * No dependencies: only Node built-ins, so it runs before `npm install`.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env');
const ENV_EXAMPLE = join(ROOT, '.env.example');
const PLACEHOLDER_KEY_PREFIX = 'change_me';
const MIN_NODE_MAJOR = 22;

const args = new Set(process.argv.slice(2));
const YES = args.has('--yes') || args.has('-y') || !stdin.isTTY;
const NO_START = args.has('--no-start');

// ---------------------------------------------------------------- output ----

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};
const ok = (msg) => console.log(`${c.green('✔')} ${msg}`);
const warn = (msg) => console.log(`${c.yellow('!')} ${msg}`);
const fail = (msg) => {
  console.error(`${c.red('✖')} ${msg}`);
  process.exit(1);
};
const step = (n, title) => console.log(`\n${c.bold(`${n}/5`)} ${c.bold(title)}`);

// ---------------------------------------------------------------- prompts ---

const rl = YES ? null : createInterface({ input: stdin, output: stdout });

async function ask(question, fallback) {
  if (YES) return fallback;
  const answer = (await rl.question(`  ${question} ${c.dim(`[${fallback}]`)} `)).trim();
  return answer === '' ? fallback : answer;
}

async function confirm(question, fallback = true) {
  if (YES) return fallback;
  const hint = fallback ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`  ${question} ${c.dim(`[${hint}]`)} `)).trim().toLowerCase();
  if (answer === '') return fallback;
  return answer === 'y' || answer === 'yes';
}

// ---------------------------------------------------------------- helpers ---

function run(cmd, cmdArgs, { inherit = false } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  });
  return { ok: result.status === 0, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}

/** Parse KEY=value lines; keeps comments/blank lines out of the map. */
function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/** Replace the value of KEY in place, or append it if missing. */
function setEnvValue(text, key, value) {
  const re = new RegExp(`^(\\s*${key}\\s*=).*$`, 'm');
  if (re.test(text)) return text.replace(re, `$1${value}`);
  return `${text.replace(/\s*$/, '')}\n${key}=${value}\n`;
}

async function waitForHealth(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
    stdout.write('.');
  }
  return null;
}

// ---------------------------------------------------------------- main ------

async function main() {
  console.log(c.bold('\nWiki MCP setup'));
  console.log(c.dim('Markdown wiki + MCP server + search + web UI, all self-hosted.\n'));
  if (YES) console.log(c.dim('Running non-interactively: using defaults for every prompt.'));

  // 1. Prerequisites ---------------------------------------------------------
  step(1, 'Checking prerequisites');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < MIN_NODE_MAJOR) {
    fail(`Node ${MIN_NODE_MAJOR}+ is required, found ${process.versions.node}. Install it from https://nodejs.org`);
  }
  ok(`Node ${process.versions.node}`);

  const dockerVersion = run('docker', ['--version']);
  if (!dockerVersion.ok) {
    fail('Docker is not installed or not on PATH. Install Docker Desktop: https://docs.docker.com/get-docker/');
  }
  ok(dockerVersion.out);

  const compose = run('docker', ['compose', 'version']);
  if (!compose.ok) {
    fail('Docker Compose v2 is missing ("docker compose"). It ships with Docker Desktop; on Linux install the docker-compose-plugin package.');
  }
  ok(compose.out);

  const dockerInfo = run('docker', ['info']);
  if (!dockerInfo.ok) {
    fail('Docker is installed but the daemon is not running. Start Docker Desktop (or `sudo systemctl start docker`) and run setup again.');
  }
  ok('Docker daemon is running');

  // 2. .env ------------------------------------------------------------------
  step(2, 'Configuration file');

  if (!existsSync(ENV_EXAMPLE)) fail('.env.example is missing; are you running this from the repository root?');

  let created = false;
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE, 'utf8'));
    created = true;
    ok('Created .env from .env.example');
  } else {
    ok('.env already exists, keeping your values');
  }
  let env = readFileSync(ENV_FILE, 'utf8');
  let values = parseEnv(env);

  // 3. Meilisearch key -------------------------------------------------------
  step(3, 'Search engine password');
  console.log(
    c.dim(
      '  Meilisearch runs as a local container (open source, no account). The key is just a\n' +
        '  password that locks your own instance; nothing is sent to any service.'
    )
  );

  const currentKey = values.get('MEILISEARCH_KEY') ?? '';
  if (!currentKey || currentKey.startsWith(PLACEHOLDER_KEY_PREFIX)) {
    const key = randomBytes(32).toString('hex');
    env = setEnvValue(env, 'MEILISEARCH_KEY', key);
    ok('Generated a random MEILISEARCH_KEY');
  } else {
    ok('MEILISEARCH_KEY is already set');
  }

  // 4. Ports -----------------------------------------------------------------
  step(4, 'Ports');

  const askPort = async (label, key, fallback) => {
    for (;;) {
      const value = await ask(`${label} port`, values.get(key) || fallback);
      if (/^\d+$/.test(value) && Number(value) > 0 && Number(value) < 65536) return value;
      console.log(c.red('  Please enter a number between 1 and 65535.'));
    }
  };
  const apiPort = await askPort('API / MCP', 'API_PORT', '3000');
  const uiPort = await askPort('Web UI', 'UI_PORT', '80');
  env = setEnvValue(env, 'API_PORT', apiPort);
  env = setEnvValue(env, 'UI_PORT', uiPort);

  writeFileSync(ENV_FILE, env);
  values = parseEnv(env);
  ok(`Saved .env ${created ? '' : c.dim('(updated)')}`);

  // 5. Start -----------------------------------------------------------------
  step(5, 'Start the stack');

  const uiUrl = `http://localhost${uiPort === '80' ? '' : `:${uiPort}`}`;
  const apiUrl = `http://localhost:${apiPort}`;

  const start = NO_START ? false : await confirm('Build and start with Docker Compose now?', true);
  rl?.close();

  if (start) {
    console.log(c.dim('\n  Running: docker compose up -d --build  (first build takes a few minutes)\n'));
    const up = run('docker', ['compose', 'up', '-d', '--build'], { inherit: true });
    if (!up.ok) fail('docker compose failed. See the output above; `docker compose logs` shows service logs.');

    stdout.write('\n  Waiting for the API to become healthy ');
    const health = await waitForHealth(`${apiUrl}/health`, 120_000);
    console.log('');
    if (!health) {
      warn(`The API did not answer within 2 minutes. Check: docker compose logs -f wiki-api`);
    } else {
      ok(`API healthy${health.meilisearch ? ', Meilisearch connected' : ' (Meilisearch not ready yet, SQLite search in use)'}`);
    }
  } else {
    console.log(c.dim('  Skipped. Start later with:  docker compose up -d --build'));
  }

  // Summary ------------------------------------------------------------------
  console.log(`\n${c.bold('Done.')}\n`);
  console.log(`  Web UI      ${c.cyan(uiUrl)}`);
  console.log(`  REST API    ${c.cyan(`${apiUrl}/api`)}`);
  console.log(`  MCP server  ${c.cyan(`${apiUrl}/mcp`)}`);
  console.log(`  Your pages  ${c.cyan(join(ROOT, 'content'))}\n`);
  console.log('  Connect an AI agent (Claude Code, Cursor, …) with:');
  console.log(c.dim('  ' + JSON.stringify({ mcpServers: { wiki: { url: `${apiUrl}/mcp` } } }, null, 2).replace(/\n/g, '\n  ')));
  console.log('\n  Useful commands:');
  console.log(c.dim('    docker compose logs -f     follow logs'));
  console.log(c.dim('    docker compose down        stop (your data stays in ./content and ./data)'));
  console.log(c.dim('    npm run setup              run this again (keeps your .env values)\n'));
}

main().catch((err) => {
  rl?.close();
  fail(err instanceof Error ? err.message : String(err));
});
