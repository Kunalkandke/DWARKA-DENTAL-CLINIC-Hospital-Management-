const supabase = require('./supabase');

/**
 * Verifies Supabase connectivity by querying the clinics table.
 * Throws if the query returns an error (connection failure, missing table, etc.).
 */
async function connectDB() {
  const { error } = await supabase.from('clinics').select('id').limit(1);
  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  console.log('[DB] Supabase connected successfully');
}

module.exports = { connectDB };
