/**
 * One-time Supabase schema migration runner.
 *
 * This script applies the full PostgreSQL schema to your Supabase project.
 * It works by POSTing each SQL statement to the Supabase REST API using
 * the service-role key, which has full database access.
 *
 * The approach: first bootstrap an exec_sql helper via a known-working
 * Supabase SQL execution endpoint, then run all remaining statements.
 *
 * Run: node run-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase exposes a SQL-over-HTTP endpoint at /rest/v1/rpc/
// We need to bootstrap using the Management API or pg driver.
// Since pg password isn't available, we use a node-fetch approach
// against the Supabase pg REST endpoint with raw SQL batches.

async function execSQL(sql) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, text };
  }
  return { ok: true };
}

async function checkExecSqlExists() {
  const result = await execSQL('SELECT 1');
  // PGRST202 = function not found
  if (!result.ok && result.text?.includes('PGRST202')) return false;
  return result.ok;
}

function splitSQLBlocks(sql) {
  const blocks = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    if (!inDollarQuote && sql[i] === '$') {
      const match = sql.slice(i).match(/^\$([A-Za-z_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      current += dollarTag;
      i += dollarTag.length;
      inDollarQuote = false;
      dollarTag = '';
      continue;
    }
    if (!inDollarQuote && sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (!inDollarQuote && sql[i] === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') blocks.push(trimmed);
      current = '';
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks;
}

async function runMigration() {
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260101000000_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`[Migration] Project: ${projectRef}`);
  console.log('[Migration] Checking if exec_sql function exists...');

  const hasExecSql = await checkExecSqlExists();

  if (!hasExecSql) {
    console.log('\n' + '='.repeat(72));
    console.log('ACTION REQUIRED — Run this in Supabase SQL Editor (one-time setup):');
    console.log('='.repeat(72));
    console.log(`
  1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new
  2. Paste and run this SQL to create an exec helper:

     CREATE OR REPLACE FUNCTION exec_sql(query text)
     RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
     $$ BEGIN EXECUTE query; END; $$;

  3. Then paste and run the FULL migration SQL from:
     ${sqlPath}

  4. After running, come back and run: node run-migration.js --verify

Alternatively, paste the FULL migration SQL directly (it already contains
all CREATE IF NOT EXISTS statements — just run it all at once).
`);
    console.log('='.repeat(72));
    console.log('\n[Migration] Direct link to SQL Editor:');
    console.log(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    return;
  }

  const blocks = splitSQLBlocks(sql);
  console.log(`[Migration] Executing ${blocks.length} SQL statements...\n`);

  let passed = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block || block === ';') continue;

    const result = await execSQL(block);
    const preview = block.substring(0, 70).replace(/\n/g, ' ');

    if (result.ok) {
      passed++;
      process.stdout.write(`  ✅ [${String(i + 1).padStart(3)}] ${preview}\n`);
    } else if (result.text?.includes('already exists')) {
      skipped++;
      process.stdout.write(`  ⚠️  [${String(i + 1).padStart(3)}] Already exists — ${preview}\n`);
    } else {
      failed++;
      process.stdout.write(`  ❌ [${String(i + 1).padStart(3)}] FAILED — ${preview}\n`);
      errors.push({ stmt: preview, error: result.text });
    }
  }

  console.log(`\n[Migration] Results: ✅ ${passed} ok | ⚠️  ${skipped} already exist | ❌ ${failed} failed`);

  if (errors.length > 0) {
    console.error('\n[Migration] Failures:');
    errors.forEach((e, idx) => {
      console.error(`\n  ${idx + 1}. Statement: ${e.stmt}`);
      try {
        const parsed = JSON.parse(e.error);
        console.error(`     Error: ${parsed.message || e.error}`);
      } catch {
        console.error(`     Error: ${e.error}`);
      }
    });
    process.exit(1);
  }

  console.log('\n[Migration] ✅ Schema migration complete!');
}

// --verify mode: just check the tables exist
if (process.argv.includes('--verify')) {
  (async () => {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const tables = ['clinics','users','patients','appointments','clinical_records','payments','invoices','files','ai_reports','notifications','audit_logs'];
    console.log('[Verify] Checking tables exist...');
    for (const t of tables) {
      const { error } = await sb.from(t).select('id').limit(1);
      console.log(`  ${error ? '❌' : '✅'} ${t}${error ? ` — ${error.message}` : ''}`);
    }
  })();
} else {
  runMigration().catch(err => {
    console.error('[Migration] Fatal:', err.message);
    process.exit(1);
  });
}
