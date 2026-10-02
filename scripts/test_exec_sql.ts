import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];

  for (const rpc of rpcs) {
    console.log(`Calling RPC "${rpc}"...`);
    const { data, error } = await supabase.rpc(rpc, { sql: 'SELECT 1;' });
    if (error) {
      console.log(`  Result for "${rpc}": ERROR. Message: ${error.message}. Code: ${error.code}`);
    } else {
      console.log(`  Result for "${rpc}": SUCCESS! Data:`, data);
    }
  }
}

main();
