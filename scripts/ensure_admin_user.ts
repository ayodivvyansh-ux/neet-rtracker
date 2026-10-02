import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Testing sign in to verify credentials for admin@zenengram.app...');
  const email = 'admin@zenengram.app';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ERROR: ADMIN_PASSWORD environment variable is not defined!');
    process.exit(1);
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in failed:', signInError.message);
  } else {
    console.log('Sign in succeeded! Authenticated User details:');
    console.log('ID:', signInData.user?.id);
    console.log('Email:', signInData.user?.email);
    console.log('App Metadata:', signInData.user?.app_metadata);
    console.log('User Metadata:', signInData.user?.user_metadata);
    console.log('Is Admin (app_metadata.role === "admin"):', signInData.user?.app_metadata?.role === 'admin');
  }
}

main().catch(console.error);

