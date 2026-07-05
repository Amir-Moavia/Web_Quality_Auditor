import fetch from 'node-fetch'; // testing module

async function testRateLimit() {
  console.log("Testing Rate Limiting (Sending 6 fast invalid requests)...");
  for (let i = 1; i <= 6; i++) {
    const res = await fetch('http://localhost:4000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'invalid-url-to-bypass-clone' })
    });
    const data = await res.json();
    console.log(`Request ${i} -> HTTP ${res.status}:`, data.error);
  }
}

testRateLimit();
