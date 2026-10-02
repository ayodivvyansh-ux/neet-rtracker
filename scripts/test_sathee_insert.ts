import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Signing in anonymously...');
  await supabase.auth.signInAnonymously();
  console.log('Testing dummy insert into sathee_raw_questions...');
  const dummyRow = {
    source: 'SATHEE',
    source_url: 'https://example.com',
    source_question_id: 'sathee_test_001',
    subject: 'Physics',
    chapter: 'Rotational Motion',
    subtopic: 'Moment of Inertia',
    source_type: 'PYQ',
    question_text: 'What is the moment of inertia of a sphere?',
    options: { A: '2/5 MR^2', B: '2/3 MR^2', C: 'MR^2', D: '1/2 MR^2' },
    correct_answer: 'A',
    explanation: 'For a solid sphere, I = 2/5 MR^2.',
    visual: null,
    raw_payload: { original: 'payload' },
    import_status: 'RAW',
    priority: 100
  };

  const { data, error } = await supabase.from('sathee_raw_questions').insert(dummyRow).select();
  if (error) {
    console.error('Insert failed:', error.message);
    console.log('Error code:', error.code);
    console.log('Full error:', error);
  } else {
    console.log('Insert succeeded! Row inserted:', data);
    // Delete the test row to keep database clean
    const { error: delError } = await supabase.from('sathee_raw_questions').delete().eq('source_question_id', 'sathee_test_001');
    if (delError) {
      console.error('Failed to clean up dummy row:', delError.message);
    } else {
      console.log('Cleaned up dummy row successfully.');
    }
  }
}

main();
