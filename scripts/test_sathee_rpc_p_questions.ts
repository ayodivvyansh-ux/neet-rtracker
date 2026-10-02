import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  
  const variations = [
    { name: 'import_sathee_questions', args: { p_questions: [] } },
    { name: 'import_sathee_questions', args: { p_data: [] } },
    { name: 'import_sathee_raw_questions', args: { p_questions: [] } },
    { name: 'import_sathee_raw_questions', args: { p_data: [] } },
  ];

  for (const item of variations) {
    console.log(`Calling RPC "${item.name}" with args:`, Object.keys(item.args));
    const { data, error } = await supabase.rpc(item.name, item.args);
    if (error) {
      console.log(`  Result: ERROR. Message: ${error.message}. Code: ${error.code}`);
    } else {
      console.log(`  Result: SUCCESS! Data:`, data);
    }
  }
}

main();
