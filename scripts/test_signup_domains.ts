import { supabase } from '../src/lib/supabase';

async function testSignUp(email: string) {
  console.log(`Testing signUp with ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      data: {
        role: 'admin'
      }
    }
  });

  if (error) {
    console.log(`  Failed: ${error.message} (status: ${error.status}, code: ${error.code})`);
  } else {
    console.log(`  SUCCEEDED! Created user ID: ${data.user?.id}`);
  }
}

async function main() {
  await testSignUp('admin@neet-admin.com');
  await testSignUp('admin@admin.com');
  await testSignUp('ayodivvyansh@gmail.com');
  await testSignUp('admin@zenengram.app');
}

main().catch(console.error);
