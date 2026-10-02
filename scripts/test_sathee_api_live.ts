async function testEndpoint(url: string, method: string = 'GET', body?: any) {
  try {
    console.log(`\nTesting ${method} ${url}...`);
    const options: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    console.log(`  Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`  Length: ${text.length} chars`);
    if (text.length > 0) {
      console.log(`  Body sample:`, text.slice(0, 300));
    }
  } catch (err: any) {
    console.error(`  Error:`, err.message);
  }
}

async function main() {
  const base = 'https://api.sathee.iitk.ac.in/pyqs';
  
  // Test basic GET
  await testEndpoint(`${base}/questions`);
  await testEndpoint(`${base}/search`);
  await testEndpoint(`${base}/analytics`);
  
  // Test with parameters
  await testEndpoint(`${base}/questions?subject=physics`);
  await testEndpoint(`${base}/questions?subject=Physics`);
  await testEndpoint(`${base}/questions?course=neet`);
  await testEndpoint(`${base}/questions?course=NEET`);
  await testEndpoint(`${base}/questions?exam=neet&subject=physics`);
  
  // Test POST
  await testEndpoint(`${base}/questions`, 'POST', { subject: 'physics' });
  await testEndpoint(`${base}/search`, 'POST', { query: 'physics' });
}

main();
