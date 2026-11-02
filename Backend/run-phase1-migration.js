/**
 * Phase 1 Foundation migration runner.
 * Applies the ADDITIVE Phase 1 schema (permission matrix, settings, chairs,
 * doctor blocks/availability extensions, lockout columns, refresh tokens, audit
 * log columns) to the configured Supabase project via the exec_sql RPC.
 *
 * Reuses the same exec_sql helper the existing run-migration.js relies on.
 * Additive + idempotent, so it is safe to re-run.
 *
 * Run: node run-phase1-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Backend/.env');
  process.exit(1);
}

const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

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

// Reuse the same dollar-quote-aware splitter as the original runner.
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
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260102000000_phase1_foundation.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('ERROR: migration file not found: ' + sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`[Phase1 Migration] Project: ${projectRef}`);
  console.log('[Phase1 Migration] Checking exec_sql helper...');

  const probe = await execSQL('SELECT 1');
  if (!probe.ok && probe.text && probe.text.includes('PGRST202')) {
    console.log('\n' + '='.repeat(72));
    console.log('ACTION REQUIRED — the exec_sql helper does not exist yet.');
    console.log('Run this once in the Supabase SQL Editor:');
    console.log('  CREATE OR REPLACE FUNCTION exec_sql(query text)');
    console.log("  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE query; END; $$;");
    console.log('Then re-run: node run-phase1-migration.js');
    console.log('='.repeat(72));
    console.log('\nSQL Editor: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    process.exit(1);
  }

  const blocks = splitSQLBlocks(sql);
  console.log(`[Phase1 Migration] Executing ${blocks.length} statements...\n`);

  let passed = 0, skipped = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block || block === ';') continue;
    const result = await execSQL(block);
    const preview = block.substring(0, 70).replace(/\n/g, ' ');
    if (result.ok) {
      passed++;
      process.stdout.write(`  OK  [${String(i + 1).padStart(3)}] ${preview}\n`);
    } else if (result.text && /already exists|duplicate key|multiple primary keys/i.test(result.text)) {
      skipped++;
      process.stdout.write(`  SKIP[${String(i + 1).padStart(3)}] ${preview}\n`);
    } else {
      failed++;
      process.stdout.write(`  FAIL[${String(i + 1).padStart(3)}] ${preview}\n`);
      errors.push({ stmt: preview, error: result.text });
    }
  }

  console.log(`\n[Phase1 Migration] OK ${passed} | skipped ${skipped} | failed ${failed}`);
  if (errors.length > 0) {
    console.error('\nFailures:');
    errors.forEach((e, idx) => console.error(`  ${idx + 1}. ${e.stmt}\n     -> ${e.error}`));
    process.exit(1);
  }
  console.log('\n[Phase1 Migration] Complete.');
}

runMigration().catch(err => {
  console.error('[Phase1 Migration] Fatal:', err.message);
  process.exit(1);
});
