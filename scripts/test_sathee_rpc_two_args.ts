import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  
  const rpcs = [
    'import_sathee_questions',
    'import_sathee_raw_questions',
  ];

  for (const rpc of rpcs) {
    console.log(`Calling RPC "${rpc}" with { p_subject: 'Physics', p_rows: [] }...`);
    const { data, error } = await supabase.rpc(rpc, {
      p_subject: 'Physics',
      p_rows: []
    });

    if (error) {
      console.log(`  Result for "${rpc}": ERROR. Message: ${error.message}. Code: ${error.code}`);
    } else {
      console.log(`  Result for "${rpc}": SUCCESS! Data:`, data);
    }
  }
}

main();
