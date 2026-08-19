const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.puzirezydceumecupgtq:Ademola1234%40@13.36.13.135:6543/postgres?pool_mode=session'
});

async function main() {
  await client.connect();
  console.log('DB connected!');

  // Check banks
  const banks = await client.query('SELECT id, title, subject, status, "questionCount" FROM question_banks ORDER BY status');
  console.log('\nAll banks:');
  banks.rows.forEach(b => console.log(`  [${b.status}] ${b.title} (${b.subject}) - ${b.questionCount}q`));

  await client.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
