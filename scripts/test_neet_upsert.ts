import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Signing in anonymously...');
  await supabase.auth.signInAnonymously();

  console.log('Attempting dummy upsert into neet_questions...');
  const dummyRow = {
    id: 'test_physics_q001',
    text: 'Test Physics Question Text',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    correct_answer: 'A',
    subject: 'Physics',
    chapter: 'Test Chapter'
  };

  const { data, error } = await supabase.from('neet_questions').upsert(dummyRow).select();
  if (error) {
    console.error('Upsert failed on neet_questions:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('Upsert succeeded on neet_questions! Data:', data);
    // Cleanup
    await supabase.from('neet_questions').delete().eq('id', 'test_physics_q001');
  }
}

main();
