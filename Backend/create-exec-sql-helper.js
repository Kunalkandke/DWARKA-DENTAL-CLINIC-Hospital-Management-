/**
 * One-time script to create the exec_sql helper function in Supabase.
 * Run this before running the phase1 migration.
 */
require('dotenv/config')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createExecSqlHelper() {
  console.log('[Exec SQL Helper] Creating helper function...')

  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE OR REPLACE FUNCTION exec_sql(query text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        EXECUTE query;
      END;
      $$;
    `
  }).catch(() => ({ error: 'Function does not exist yet' }))

  if (error) {
    // Function doesn't exist, create it directly
    const { error: createError } = await supabase.from('_migrations').select('*').limit(1)
    
    if (createError && createError.code === '42P01') {
      console.log('[Exec SQL Helper] Creating via SQL query...')
      const sql = `
        CREATE OR REPLACE FUNCTION exec_sql(query text)
        RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN
          EXECUTE query;
        END;
        $$;
      `
      
      // Use raw SQL execution
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: sql })
      })

      if (!response.ok) {
        console.error('[Exec SQL Helper] ERROR: Could not create helper function')
        console.error('Please manually create it in the Supabase SQL Editor:')
        console.error('\n', sql, '\n')
        process.exit(1)
      }
    }
  }

  console.log('[Exec SQL Helper] Helper function ready!')
  process.exit(0)
}

createExecSqlHelper()
