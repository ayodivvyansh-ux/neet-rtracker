import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  const views = [
    'pg_proc',
    'pg_policies',
    'pg_views',
    'information_schema.routines',
    'information_schema.columns'
  ];

  for (const v of views) {
    console.log(`Querying view "${v}"...`);
    const { data, error } = await supabase.from(v as any).select('*').limit(1);
    if (error) {
      console.log(`  Result: ERROR. Message: ${error.message}. Code: ${error.code}`);
    } else {
      console.log(`  Result: SUCCESS! Columns:`, data ? Object.keys(data[0] || {}) : 'empty');
    }
  }
}

main();
