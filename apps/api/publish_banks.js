const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.puzirezydceumecupgtq:Ademola1234%40@13.36.13.135:6543/postgres?pool_mode=session'
});

async function main() {
  await client.connect();
  console.log('Connected!');

  const res = await client.query(
    "UPDATE question_banks SET status = 'PUBLISHED', published_at = NOW() WHERE status = 'DRAFT'"
  );
  console.log('Published banks:', res.rowCount);

  const banks = await client.query('SELECT id, title, status, question_count FROM question_banks');
  console.log('\nAll banks:');
  banks.rows.forEach(function(b) { console.log('  -', b.title, '[' + b.status + ']', b.question_count, 'questions'); });

  await client.end();
}

main().catch(function(e) { console.error(e); process.exit(1); });
