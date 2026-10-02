console.log('Available env variables:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY') || k.includes('URL') || k.includes('PORT')));
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
