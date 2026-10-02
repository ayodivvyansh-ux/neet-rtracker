import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  
  const rpcs = [
    'import_sathee_questions',
    'import_sathee_raw_questions',
    'import_neet_questions'
  ];

  // Try different parameter shapes
  for (const rpc of rpcs) {
    console.log(`\n--- Testing RPC: ${rpc} ---`);
    
    // Test 1: No arguments
    {
      const { error } = await supabase.rpc(rpc);
      console.log(`  No arguments: ${error ? error.message : 'SUCCESS'}`);
    }

    // Test 2: p_rows as jsonb/json
    {
      const { error } = await supabase.rpc(rpc, { p_rows: [] });
      console.log(`  { p_rows: [] }: ${error ? error.message : 'SUCCESS'}`);
    }

    // Test 3: p_rows as json string
    {
      const { error } = await supabase.rpc(rpc, { p_rows: '[]' });
      console.log(`  { p_rows: '[]' }: ${error ? error.message : 'SUCCESS'}`);
    }

    // Test 4: rows as direct array
    {
      const { error } = await supabase.rpc(rpc, []);
      console.log(`  Direct array []: ${error ? error.message : 'SUCCESS'}`);
    }
  }
}

main();
