const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const pool = new Pool({ connectionString: neonConfig.connectionString });

const leads = [
  ['Kool It Services', 'https://koolit.co.uk/', 'sales@koolit.co.uk', '0161 877 4030', 'web_search', 'premium', 2000],
  ['Commercial Air Conditioning UK', 'https://www.commercialairconditioning.co.uk/', 'commercialairconditioninguk@gmail.com', '0161 524 0613', 'web_search', 'premium', 2000],
  ['K2 Heating & Cooling', 'https://www.k2hc.co.uk/', 'info@k2hc.co.uk', '0800 107 5097', 'web_search', 'premium', 2000],
  ['Blue Reactive Maintenance', 'https://blue-reactive-maintenance.co.uk/', 'hello@blue-reactive-maintenance.co.uk', '0800 038 9786', 'web_search', 'premium', 2000],
  ['Dentists Johannesburg', 'https://dentistsjohannesburg.co.za/', 'info@dentistsjohannesburg.co.za', null, 'web_search', 'starter', 30000],
  ['Houghton Dental', 'https://www.houghtondental.co.za/', 'smile@houghtondental.co.za', '074 804 0271', 'web_search', 'starter', 30000],
  ['Real Estates WSP', 'http://www.realestates-wsp.co.uk/', 'info@realestates-wsp.co.uk', '020 8445 6387', 'web_search', 'premium', 2000],
  ['Lawyers Alliance for New York', 'https://lawyersalliance.org/', 'info@lawyersalliance.org', '(212) 219-1800', 'web_search', 'premium', 3000],
  ['Weitz & Luxenberg', 'https://www.weitzlux.com/', 'clientrelations@weitzlux.com', '(800) 476-6070', 'web_search', 'premium', 3000],
  ['New York Legal Assistance Group', 'https://nylag.org/', 'asamuel@nylag.org', null, 'web_search', 'premium', 3000],
];

async function insertLeads() {
  let inserted = 0;
  let errors = 0;
  
  for (const lead of leads) {
    try {
      // Check for duplicate first
      const check = await pool.query('SELECT id FROM leads WHERE email = $1 LIMIT 1', [lead[2]]);
      
      if (check.rows.length > 0) {
        console.log(`≈ ${lead[0]} - duplicate (email exists)`);
        continue;
      }
      
      const result = await pool.query(
        `INSERT INTO leads (name, company, email, phone, source, tier, value_usd, status, created_at)
         VALUES ($1, $1, $2, $3, $4, $5, $6, 'new', NOW())
         RETURNING id`,
        [lead[0], lead[2], lead[3], lead[4], lead[5], lead[6]]
      );
      
      if (result.rows.length > 0) {
        console.log(`✓ ${lead[0]} (${lead[2]}) - ${lead[5]}, $${lead[6]}`);
        inserted++;
      }
    } catch (error) {
      console.log(`✗ ${lead[0]} - ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Results: ${inserted} inserted, ${errors} errors`);
  
  // Show total count
  const count = await pool.query('SELECT COUNT(*) FROM leads');
  console.log(`📦 Total leads in database: ${count.rows[0].count}\n`);
  
  await pool.end();
}

insertLeads();
