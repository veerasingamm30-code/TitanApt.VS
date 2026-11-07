// Data backup via pg client (no pg_dump in the stripped embedded distribution).
import { startEmbeddedDatabase, DEFAULT_PORT } from './embedded-db.mjs';
import pg from 'pg';
import fs from 'node:fs';

const outDir = process.env.BACKUP_DIR || 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt/dbbackup';
fs.mkdirSync(outDir, { recursive: true });
const db = await startEmbeddedDatabase();
const port = db.port ?? DEFAULT_PORT;

const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: process.env.EMBEDDED_PG_PASSWORD ?? 'titanapt_local', database: 'titanapt_dev' });
await client.connect();
const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map((r) => r.tablename);
const schema = (await client.query(`SELECT * FROM pg_ts?`, [] ).catch(() => null)) ?? null;
const dump = {};
for (const t of tables) {
  const def = await client.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
  dump[t] = {
    columns: def.rows.map((r) => ({ name: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES', default: r.column_default })),
    rows: (await client.query(`SELECT * FROM "${t}"`)).rows,
  };
}
const sequences = (await client.query(`SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public'`)).rows;
const createdAt = new Date().toISOString();
const outFile = `${outDir}/titanapt_dev-${createdAt.replace(/[:T]/g, '-').slice(0, 19)}.json`;
fs.writeFileSync(outFile, JSON.stringify({ createdAt, tables: dump, sequences }, null, 1), 'utf8');
console.log('wrote', outFile);
console.log('tables:', tables.join(', '));
console.log('user count:', dump['User']?.rows?.length ?? 'n/a');
await client.end();
process.exit(0);
