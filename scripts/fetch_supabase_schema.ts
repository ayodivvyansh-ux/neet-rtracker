import { supabaseUrl, supabaseAnonKey } from '../src/lib/supabase';

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Key is missing.');
    return;
  }

  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseAnonKey ? supabaseAnonKey.slice(0, 10) + '...' : 'MISSING');
  console.log('Fetching PostgREST OpenAPI schema...');
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch OpenAPI schema:', res.statusText);
    return;
  }

  const schema = await res.json();
  
  // 1. Log all paths (endpoints) which include RPCs and tables
  console.log('\n--- PATHS (ENDPOINTS) ---');
  const rpcs: string[] = [];
  const tables: string[] = [];
  
  Object.keys(schema.paths || {}).forEach(path => {
    if (path.startsWith('/rpc/')) {
      rpcs.push(path.slice(5));
    } else {
      tables.push(path.slice(1));
    }
  });
  
  console.log('RPCs found:', rpcs);
  console.log('Tables found:', tables);

  // 2. Log schema definitions for sathee_raw_questions
  console.log('\n--- SCHEMA DEFINITIONS ---');
  const def = schema.definitions?.sathee_raw_questions;
  if (def) {
    console.log('sathee_raw_questions definition:', JSON.stringify(def, null, 2));
  } else {
    console.log('sathee_raw_questions definition not found in definitions. Keys:', Object.keys(schema.definitions || {}));
  }
}

main().catch(console.error);
