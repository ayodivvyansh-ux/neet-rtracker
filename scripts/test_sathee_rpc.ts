import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Signing in anonymously...');
  await supabase.auth.signInAnonymously();

  console.log('Attempting to call import_sathee_raw_questions RPC...');
  const testRows = [
    {
      source: 'SATHEE',
      source_url: 'https://example.com/sathee/q1',
      source_question_id: 'sathee_test_rpc_001',
      subject: 'Physics',
      chapter: 'Rotational Motion',
      subtopic: 'Moment of Inertia',
      source_type: 'PYQ',
      question_text: 'Test moment of inertia RPC question?',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      correct_answer: 'A',
      explanation: 'Explanation text here.',
      visual: null,
      raw_payload: { original: 'payload' },
      import_status: 'RAW',
      priority: 100
    }
  ];

  const { data, error } = await supabase.rpc('import_sathee_raw_questions', {
    p_rows: testRows
  });

  if (error) {
    console.error('RPC failed:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('RPC succeeded! Data returned:', data);
    // Cleanup
    const { error: delError } = await supabase.from('sathee_raw_questions').delete().eq('source_question_id', 'sathee_test_rpc_001');
    if (delError) {
      console.warn('Could not delete test row:', delError.message);
    } else {
      console.log('Test row cleaned up successfully.');
    }
  }
}

main();
