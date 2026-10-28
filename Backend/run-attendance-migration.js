/**
 * Quick Migration Runner for Attendance Feature
 * 
 * This script applies the attendance migration to your Supabase database.
 * 
 * Usage:
 *   node run-attendance-migration.js
 * 
 * Prerequisites:
 *   - Backend/.env must have SUPABASE_URL and SUPABASE_SERVICE_KEY
 *   - Tables must not already exist (or script will show errors but continue)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('./src/config/env');

async function runMigration() {
  console.log('🚀 Starting Attendance Migration...\n');

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    process.exit(1);
  }

  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Read migration file
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260103000000_attendance_feature.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ ERROR: Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file loaded:', path.basename(migrationPath));
  console.log(`   Size: ${Math.round(migrationSQL.length / 1024)}KB\n`);

  // Split SQL into statements (basic splitting - may need adjustment for complex SQL)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
    
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Some errors are acceptable (e.g., table already exists)
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.code === '42P07') {
          console.log('⚠️  SKIPPED (already exists)');
          successCount++;
        } else {
          console.log('❌ ERROR');
          console.error(`   Error: ${error.message}`);
          errors.push({ statement: preview, error: error.message });
          errorCount++;
        }
      } else {
        console.log('✅');
        successCount++;
      }
    } catch (err) {
      console.log('❌ ERROR');
      console.error(`   Exception: ${err.message}`);
      errors.push({ statement: preview, error: err.message });
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount} statements`);
  console.log(`❌ Failed: ${errorCount} statements`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. ${err.statement}`);
      console.log(`   ${err.error}`);
    });
  }

  // Verify tables created
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Verifying Tables:');
  console.log('='.repeat(60));

  try {
    const { data: attendanceTable, error: err1 } = await supabase
      .from('attendance')
      .select('*')
      .limit(0);
    
    if (!err1) {
      console.log('✅ attendance table exists');
    } else {
      console.log('❌ attendance table NOT found:', err1.message);
    }

    const { data: leaveTable, error: err2 } = await supabase
      .from('leave_requests')
      .select('*')
      .limit(0);
    
    if (!err2) {
      console.log('✅ leave_requests table exists');
    } else {
      console.log('❌ leave_requests table NOT found:', err2.message);
    }

    const { data: perms, error: err3 } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('resource', 'attendance');
    
    if (!err3 && perms && perms.length > 0) {
      console.log(`✅ ${perms.length} attendance permissions seeded`);
    } else {
      console.log('❌ attendance permissions NOT found');
    }

  } catch (verifyErr) {
    console.log('⚠️  Could not verify tables:', verifyErr.message);
  }

  console.log('\n' + '='.repeat(60));
  
  if (errorCount === 0) {
    console.log('✅ Migration completed successfully!');
    console.log('\n🎉 Attendance feature is ready to use!');
    console.log('\nNext steps:');
    console.log('  1. Restart your backend: npm start');
    console.log('  2. Refresh frontend in browser');
    console.log('  3. Go to /admin/attendance and test!');
  } else {
    console.log('⚠️  Migration completed with errors.');
    console.log('\nTroubleshooting:');
    console.log('  - If errors are "already exists", migration may have run before (OK)');
    console.log('  - For other errors, try running SQL manually in Supabase Dashboard');
    console.log('  - See: .agents/tasks/FIX-ATTENDANCE-ERROR.md');
  }

  console.log('='.repeat(60) + '\n');
}

// Note: Supabase doesn't have exec_sql RPC by default
// This script will fail unless you create it or use alternative method
console.log('⚠️  NOTE: This script requires a custom exec_sql RPC function in Supabase.');
console.log('For the easiest method, copy/paste the SQL directly in Supabase Dashboard.');
console.log('See: .agents/tasks/APPLY-ATTENDANCE-MIGRATION.md\n');

// Uncomment to run:
// runMigration().catch(console.error);

console.log('Alternative: Run SQL manually in Supabase Dashboard (recommended)');
console.log('File: Backend/supabase/migrations/20260103000000_attendance_feature.sql');
