const { Client } = require('pg');
const http = require('http');

// 1. Test raw DB
const client = new Client({
  connectionString: 'postgresql://postgres.puzirezydceumecupgtq:Ademola1234%40@13.36.13.135:6543/postgres?pool_mode=session'
});

async function main() {
  // Test DB
  await client.connect();
  const r = await client.query('SELECT id, title, status FROM question_banks WHERE status = $1', ['PUBLISHED']);
  console.log('PUBLISHED banks in DB:', r.rows.length, r.rows.map(b => b.title).join(', '));
  await client.end();

  // Test API HTTP
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/api/banks', (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log('API /api/banks status:', res.statusCode);
        console.log('API response:', data.slice(0, 200));
        resolve();
      });
    });
    req.on('error', e => {
      console.error('API request failed:', e.message);
      resolve();
    });
    req.setTimeout(5000, () => {
      console.error('API request timed out');
      req.destroy();
      resolve();
    });
  });
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
