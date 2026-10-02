import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Checking Supabase connection and tables...');
  // Let us check if we can select from sathee_raw_questions
  const { data, error } = await supabase.from('sathee_raw_questions').select('*').limit(1);
  if (error) {
    console.error('Error selecting from sathee_raw_questions:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('SUCCESS! sathee_raw_questions table is accessible. Data:', data);
  }
}

main();
