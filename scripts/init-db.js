const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load Neon credentials
const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));

const pool = new Pool({
  connectionString: neonConfig.connectionString
});

async function initDB() {
  const schemaPath = path.join(__dirname, '../infra/neon-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  console.log('🔌 Connecting to Neon...');
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected. Running schema...');
    await client.query(schema);
    console.log('✅ Schema applied successfully!');
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    console.log(`\n✅ Database initialized! ${tables.rows.length} tables ready.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDB().catch(console.error);
