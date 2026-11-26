// Starts a local embedded PostgreSQL cluster for development.
// Usage: node scripts/db.mjs start|stop|status
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('.pgdata');
const PORT = Number(process.env.PG_PORT || 5432);
const USER = process.env.PG_USER || 'postgres';
const PASSWORD = process.env.PG_PASSWORD || 'postgres';
const DB = process.env.PG_DATABASE || 'quizvault';

const cmd = process.argv[2] || 'start';

async function getPg() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    onLog: () => {},
    onError: (m) => console.error('[pg]', m),
  });
}

if (cmd === 'start') {
  const pg = await getPg();
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Initialising cluster in', DATA_DIR);
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DB);
    console.log(`Created database ${DB}`);
  } catch {
    // database already exists
  }
  console.log(`PostgreSQL ready: postgres://${USER}:***@localhost:${PORT}/${DB}`);
  // keep process alive while postgres runs
  process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
  setInterval(() => {}, 60000);
} else if (cmd === 'stop') {
  // best-effort: connect and issue shutdown is not exposed; just report.
  console.log('Stop the `db.mjs start` process (Ctrl+C) to shut down Postgres.');
} else if (cmd === 'status') {
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Expected URL: postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`);
}
