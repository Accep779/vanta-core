const fs = require('fs');
const { Pool } = require('pg');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const pool = new Pool({ connectionString: neonConfig.connectionString });

async function getStats() {
  const newLeads = await pool.query("SELECT COUNT(*) FROM leads WHERE status = 'new'");
  const contacted = await pool.query("SELECT COUNT(*) FROM leads WHERE status = 'contacted'");
  const exhausted = await pool.query("SELECT COUNT(*) FROM leads WHERE status = 'exhausted'");
  
  console.log('\n📊 LeadFlow Campaign Summary');
  console.log('═══════════════════════════════');
  console.log(`New leads remaining: ${newLeads.rows[0].count}`);
  console.log(`Contacted: ${contacted.rows[0].count}`);
  console.log(`Exhausted (all follow-ups sent): ${exhausted.rows[0].count}`);
  
  const today = await pool.query("SELECT COUNT(*) FROM leads WHERE DATE(contacted_at) = CURRENT_DATE");
  console.log(`Sent today: ${today.rows[0].count}`);
  
  pool.end();
}

getStats();
