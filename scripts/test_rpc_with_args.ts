import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Signing in anonymously...');
  await supabase.auth.signInAnonymously();
  console.log('Testing import_neet_questions RPC with correct signature...');
  const { data, error } = await supabase.rpc('import_neet_questions', {
    p_subject: 'Physics',
    p_rows: []
  });

  if (error) {
    console.error('RPC failed:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('RPC succeeded! Data:', data);
  }
}

main();
