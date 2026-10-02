import { supabase } from '../src/lib/supabase';

async function main() {
  const rpcs = [
    'import_sathee_questions',
    'import_sathee_raw_questions',
    'upsert_sathee_questions',
    'save_sathee_questions',
    'import_neet_questions' // We know this one exists
  ];

  for (const rpc of rpcs) {
    console.log(`Calling RPC "${rpc}"...`);
    const { data, error } = await supabase.rpc(rpc, { p_rows: [] });
    if (error) {
      console.log(`  Result for "${rpc}": ERROR. Message: ${error.message}. Code: ${error.code}`);
    } else {
      console.log(`  Result for "${rpc}": SUCCESS! Data:`, data);
    }
  }
}

main();
