console.log('--- Dumping all env variables ---');
Object.keys(process.env).forEach(key => {
  const val = process.env[key];
  const masked = val ? (val.length > 8 ? val.slice(0, 4) + '...' + val.slice(-4) : '***') : 'empty';
  console.log(`${key}=${masked}`);
});
