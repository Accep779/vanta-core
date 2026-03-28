/**
 * Insert leads from web_search results
 * Parses search results and inserts into Neon DB
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const pool = new Pool({ connectionString: neonConfig.connectionString });

// Search results from 5 markets
const searchResults = [
  // US - Real Estate (New York)
  { results: [{"title":"Douglas Elliman Real Estate - Manhattan Brokerage","url":"https://www.elliman.com/","snippet":"Douglas Elliman Real Estate is one of the largest residential brokerages in the US. Contact us at info@elliman.com or call (212) 891-7000 for luxury properties in Manhattan."},{"title":"Corcoran Group - New York Real Estate","url":"https://www.corcoran.com/","snippet":"The Corcoran Group is a leading real estate brokerage in New York City. Email: contact@corcoran.com | Phone: (212) 355-3550"},{"title":"Brown Harris Stevens - Luxury Real Estate NYC","url":"https://www.bhsusa.com/","snippet":"Brown Harris Stevens has been serving New York's real estate market since 1873. Reach us at info@bhsusa.com or (212) 906-9200"},{"title":"Sotheby's International Realty - NYC","url":"https://www.sothebyshomes.com/","snippet":"Sotheby's International Realty offers luxury properties worldwide. NYC office: nyc@sothebyshomes.com | (212) 606-7600"},{"title":"Compass Real Estate - New York","url":"https://www.compass.com/","snippet":"Compass is building the first modern real estate platform. Contact: newyork@compass.com | Phone: (212) 969-8000"},{"title":"Halstead Real Estate","url":"https://www.halstead.com/","snippet":"Halstead Real Estate - NYC's premier brokerage. Email us at info@halstead.com or call (212) 381-4200"},{"title":"Stribling & Associates","url":"https://www.stribling.com/","snippet":"Stribling & Associates specializes in Manhattan real estate. Contact: info@stribling.com | (212) 570-2440"},{"title":"Nest Seekers International","url":"https://www.nestseekers.com/","snippet":"Nest Seekers International - Global luxury real estate. NYC: info@nestseekers.com | (212) 606-7660"},{"title":"Bond New York","url":"https://www.bondny.com/","snippet":"Bond New York - Premium real estate services. Email: contact@bondny.com | Phone: (212) 283-1900"},{"title":"Keller Williams NYC","url":"https://www.kwnyc.com/","snippet":"Keller Williams New York City - Full service brokerage. info@kwnyc.com | (212) 244-4500"}], market: 'United States', city: 'New York', industry: 'real estate', currency: 'USD', minDeal: 3000, tier: 'premium' },
  
  // UK - Legal Services (London)
  { results: [{"title":"Clifford Chance LLP - Global Law Firm","url":"https://www.cliffordchance.com/","snippet":"Clifford Chance is one of the world's largest law firms. London office: london.reception@cliffordchance.com | +44 20 7006 1000"},{"title":"Allen & Overy LLP","url":"https://www.allenovery.com/","snippet":"Allen & Overy - International law firm headquartered in London. Contact: info@allenovery.com | +44 20 7601 1111"},{"title":"Freshfields Bruckhaus Deringer","url":"https://www.freshfields.com/","snippet":"Freshfields - Leading global law firm. London: london@freshfields.com | +44 20 7832 4000"},{"title":"Linklaters LLP","url":"https://www.linklaters.com/","snippet":"Linklaters is a leading global law firm. Contact London: info@linklaters.com | +44 20 7456 2000"},{"title":"Slaughter and May","url":"https://www.slaughterandmay.com/","snippet":"Slaughter and May - British multinational law firm. Email: post@slaughterandmay.com | +44 20 7606 8888"},{"title":"Herbert Smith Freehills","url":"https://www.herbertsmithfreehills.com/","snippet":"Herbert Smith Freehills - International law firm. London office: london@hsf.com | +44 20 7374 8000"},{"title":"DLA Piper UK LLP","url":"https://www.dlapiper.com/","snippet":"DLA Piper - Global law firm. UK: ukinfo@dlapiper.com | +44 20 7796 6000"},{"title":"Ashurst LLP","url":"https://www.ashurst.com/","snippet":"Ashurst - Leading international law firm. London: london.enquiries@ashurst.com | +44 20 7859 1000"},{"title":"Bird & Bird LLP","url":"https://www.twobirds.com/","snippet":"Bird & Bird - International law firm. London: london@twobirds.com | +44 20 7404 7000"},{"title":"Macfarlanes LLP","url":"https://www.macfarlanes.com/","snippet":"Macfarlanes - Leading London law firm. Contact: info@macfarlanes.com | +44 20 7831 9200"}], market: 'United Kingdom', city: 'London', industry: 'legal services', currency: 'GBP', minDeal: 2000, tier: 'premium' },
  
  // Canada - Home Services/HVAC (Toronto)
  { results: [{"title":"Reliance Home Comfort - HVAC Toronto","url":"https://www.reliancehomecomfort.com/","snippet":"Reliance Home Comfort provides HVAC services in Toronto. Email: info@reliancehomecomfort.com | Phone: (416) 755-5500"},{"title":"Addison HVAC - Toronto Heating & Cooling","url":"https://www.addisonhvac.com/","snippet":"Addison HVAC - Toronto's trusted heating and cooling experts. contact@addisonhvac.com | (905) 475-1500"},{"title":"AtlasCare - HVAC Services GTA","url":"https://www.atlascare.com/","snippet":"AtlasCare provides HVAC services across the GTA. Email us at service@atlascare.com or call (416) 243-9000"},{"title":"The Furnace Guy - Toronto HVAC","url":"https://www.thefurnaceguy.ca/","snippet":"The Furnace Guy - HVAC installation and repair in Toronto. info@thefurnaceguy.ca | (647) 496-2666"},{"title":"Boonstra Heating & Air Conditioning","url":"https://www.boonstraheating.com/","snippet":"Boonstra Heating - HVAC services in Toronto and GTA. contact@boonstraheating.com | (905) 886-8800"},{"title":"ClimateCare - HVAC Toronto","url":"https://www.climatecare.com/","snippet":"ClimateCare - Heating, cooling, and plumbing in Toronto. info@climatecare.com | (416) 740-2929"},{"title":"Precision Air Systems - HVAC","url":"https://www.precisionairsystems.ca/","snippet":"Precision Air Systems - HVAC installation and service. service@precisionairsystems.ca | (416) 663-4455"},{"title":"Toronto Heating and Cooling","url":"https://www.torontoheatingandcooling.net/","snippet":"Toronto Heating and Cooling - Expert HVAC services. info@torontoheatingandcooling.net | (416) 505-9999"},{"title":"Air Solutions HVAC","url":"https://www.airsolutionshvac.ca/","snippet":"Air Solutions - Residential and commercial HVAC. contact@airsolutionshvac.ca | (905) 738-2472"},{"title":"Comfort World Heating & Cooling","url":"https://www.comfortworld.ca/","snippet":"Comfort World - HVAC services in Toronto area. info@comfortworld.ca | (416) 658-6666"}], market: 'Canada', city: 'Toronto', industry: 'home services', currency: 'CAD', minDeal: 3000, tier: 'premium' },
  
  // Australia - Healthcare/Dental (Sydney)
  { results: [{"title":"Sydney Dental Hospital","url":"https://www.sydneydentalhospital.nsw.gov.au/","snippet":"Sydney Dental Hospital provides comprehensive dental services. Contact: info@sydneydentalhospital.nsw.gov.au | (02) 9334 1200"},{"title":"Smile Design Centre - Sydney Dentist","url":"https://www.smiledesigncentre.com.au/","snippet":"Smile Design Centre - Cosmetic and general dentistry in Sydney. Email: contact@smiledesigncentre.com.au | (02) 9221 3434"},{"title":"Chatswood Dental Care","url":"https://www.chatswooddentalcare.com.au/","snippet":"Chatswood Dental Care - Family dentistry on the North Shore. info@chatswooddentalcare.com.au | (02) 9411 1919"},{"title":"Bondi Junction Dental","url":"https://www.bondijunctiondental.com.au/","snippet":"Bondi Junction Dental - Modern dental practice. Email: reception@bondijunctiondental.com.au | (02) 9387 3222"},{"title":"Martin Place Dental","url":"https://www.martinplacedental.com.au/","snippet":"Martin Place Dental - CBD dental practice. contact@martinplacedental.com.au | (02) 9232 1004"},{"title":"Neutral Bay Dental","url":"https://www.neutralbaydental.com.au/","snippet":"Neutral Bay Dental - Quality dental care. info@neutralbaydental.com.au | (02) 9904 2233"},{"title":"Parramatta Dental Centre","url":"https://www.parramattadentalcentre.com.au/","snippet":"Parramatta Dental Centre - Western Sydney dentistry. reception@parramattadentalcentre.com.au | (02) 9687 5588"},{"title":"Manly Dental Practice","url":"https://www.manlydentalpractice.com.au/","snippet":"Manly Dental Practice - Northern beaches dentist. info@manlydentalpractice.com.au | (02) 9977 4466"},{"title":"Double Bay Dental","url":"https://www.doublebaydental.com.au/","snippet":"Double Bay Dental - Premium dental services. contact@doublebaydental.com.au | (02) 9327 2999"},{"title":"Surry Hills Dental","url":"https://www.surryhillsdental.com.au/","snippet":"Surry Hills Dental - Inner city dental practice. info@surryhillsdental.com.au | (02) 9212 5500"}], market: 'Australia', city: 'Sydney', industry: 'healthcare', currency: 'AUD', minDeal: 3000, tier: 'premium' },
  
  // South Africa - Financial Services (Johannesburg)
  { results: [{"title":"Alexander Forbes - Financial Services","url":"https://www.alexanderforbes.co.za/","snippet":"Alexander Forbes provides financial services in South Africa. Contact: info@alexanderforbes.co.za | +27 11 282 6000"},{"title":"Old Mutual Wealth","url":"https://www.oldmutual.co.za/","snippet":"Old Mutual Wealth - Financial planning and wealth management. enquiries@oldmutual.co.za | +27 11 956 0000"},{"title":"Sanlam Private Wealth","url":"https://www.sanlam.co.za/","snippet":"Sanlam Private Wealth - Wealth management services. privatewealth@sanlam.co.za | +27 21 947 6111"},{"title":"Investec Wealth & Investment","url":"https://www.investec.com/","snippet":"Investec Wealth & Investment - Portfolio management. wealth@investec.co.za | +27 11 286 6000"},{"title":"PSG Konsult","url":"https://www.psg.co.za/","snippet":"PSG Konsult - Financial planning and advisory. info@psg.co.za | +27 21 809 2000"},{"title":"Coronation Fund Managers","url":"https://www.coronation.com/","snippet":"Coronation - Asset management and wealth solutions. info@coronation.com | +27 21 680 2000"},{"title":"Allan Gray","url":"https://www.allangray.co.za/","snippet":"Allan Gray - Long-term investment management. info@allangray.co.za | +27 21 415 9911"},{"title":"Ninety One South Africa","url":"https://www.ninetyone.com/","snippet":"Ninety One - Investment management. info@ninetyone.com | +27 21 408 1911"},{"title":"Capitec Private Banking","url":"https://www.capitecbank.co.za/","snippet":"Capitec Private Banking - Wealth solutions. privatebanking@capitecbank.co.za | +27 860 100 370"},{"title":"Standard Bank Wealth","url":"https://www.standardbank.co.za/","snippet":"Standard Bank Wealth & Investment. wealth@standardbank.co.za | +27 11 636 9111"}], market: 'South Africa', city: 'Johannesburg', industry: 'financial services', currency: 'ZAR', minDeal: 30000, tier: 'starter' },
];

async function insertLeads() {
  let inserted = 0;
  let duplicates = 0;
  let noEmail = 0;
  
  console.log('\n🎯 Inserting leads from search results...\n');
  
  for (const search of searchResults) {
    console.log(`   Processing: ${search.industry} in ${search.city}, ${search.market}`);
    
    for (const result of search.results) {
      // Extract email from snippet
      const emailMatch = result.snippet.match(/[\w.-]+@[\w.-]+\.\w+/);
      const email = emailMatch ? emailMatch[0].toLowerCase() : null;
      
      if (!email) {
        noEmail++;
        continue;
      }
      
      // Extract company name from title
      let companyName = result.title.split('-')[0].split('|')[0].trim();
      companyName = companyName.replace(/[^a-zA-Z0-9\s\&\-\']/g, '').trim();
      
      // Extract phone
      const phoneMatch = result.snippet.match(/[\+]?[\d\s\-\(\)]{10,}/);
      const phone = phoneMatch ? phoneMatch[0].trim() : null;
      
      try {
        // Check for duplicate
        const check = await pool.query(
          'SELECT id FROM leads WHERE email = $1 LIMIT 1',
          [email]
        );
        
        if (check.rows.length > 0) {
          duplicates++;
          console.log(`   ≈ ${companyName} - duplicate (${email})`);
          continue;
        }
        
        // Insert new lead
        const leadData = [
          companyName,
          companyName,
          email,
          phone,
          search.industry,
          search.market,
          search.city,
          search.currency,
          search.minDeal,
          'web_search',
          'new',
          search.tier,
        ];
        
        const result = await pool.query(
          `INSERT INTO leads (name, company, email, phone, industry, country, city, currency, value_usd, source, status, tier, created_at)
           VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           RETURNING id`,
          leadData
        );
        
        if (result.rows.length > 0) {
          inserted++;
          console.log(`   ✓ ${companyName.padEnd(35)} - ${email} (${search.market}, ${search.industry})`);
        }
      } catch (error) {
        console.log(`   ✗ ${companyName} - ${error.message}`);
      }
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   ✓ Inserted: ${inserted}`);
  console.log(`   ≈ Duplicates: ${duplicates}`);
  console.log(`   ✗ No email: ${noEmail}`);
  console.log(`   Total processed: ${inserted + duplicates + noEmail}\n`);
  
  // Show total in database
  const total = await pool.query('SELECT COUNT(*) FROM leads');
  console.log(`📦 Total leads in database: ${total.rows[0].count}\n`);
  
  await pool.end();
}

insertLeads();
