import { supabase } from '../src/lib/supabase';

async function main() {
  await supabase.auth.signInAnonymously();
  const { data, error } = await supabase.from('public_physics_questions').select('*').limit(1);
  if (error) {
    console.error('Error fetching physics_questions:', error);
  } else {
    console.log('Physics question columns:', data[0] ? Object.keys(data[0]) : 'no rows');
    console.log('Sample physics question row:', data[0]);
  }
}

main();
