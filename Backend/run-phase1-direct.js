/**
 * Direct migration runner that doesn't use exec_sql RPC
 * Reads the SQL file and executes it line by line
 */
require('dotenv/config')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  console.log('[Phase1 Migration] Reading SQL file...')
  
  const sqlPath = path.join(__dirname, 'supabase/migrations/20260102000000_phase1_foundation.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  
  console.log('[Phase1 Migration] Executing SQL...')
  console.log('NOTE: This uses REST API, some statements may need manual execution in SQL Editor')
  
  // Split by semicolons but preserve them in statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10)
  
  console.log(`[Phase1 Migration] Found ${statements.length} SQL statements`)
  
  // For Supabase, we need to execute this via their SQL API
  // The service role key allows direct SQL execution
  const fullSql = statements.join(';\n') + ';'
  
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: fullSql })
    })
    
    if (response.ok) {
      console.log('[Phase1 Migration] ✓ Migration completed successfully!')
    } else {
      const error = await response.text()
      console.error('[Phase1 Migration] Failed:', error)
      console.log('\n══════════════════════════════════════════════════════════════')
      console.log('MANUAL MIGRATION REQUIRED')
      console.log('══════════════════════════════════════════════════════════════')
      console.log('Please open your Supabase SQL Editor and run the following file:')
      console.log(sqlPath)
      console.log('\nSQL Editor URL:')
      console.log(`https://supabase.com/dashboard/project/${process.env.SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]}/sql/new`)
      console.log('══════════════════════════════════════════════════════════════\n')
      process.exit(1)
    }
  } catch (err) {
    console.error('[Phase1 Migration] Error:', err.message)
    console.log('\n══════════════════════════════════════════════════════════════')
    console.log('MANUAL MIGRATION REQUIRED')
    console.log('══════════════════════════════════════════════════════════════')
    console.log('Please open your Supabase SQL Editor and run the following file:')
    console.log(sqlPath)
    console.log('\nSQL Editor URL:')
    console.log(`https://supabase.com/dashboard/project/chfidbjpmpkjaryfvany/sql/new`)
    console.log('══════════════════════════════════════════════════════════════\n')
    process.exit(1)
  }
  
  process.exit(0)
}

runMigration()
