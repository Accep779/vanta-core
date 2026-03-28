/**
 * Insert Kumasi Auto Dealers Leads
 * 25 high-fit dealers from africalistings
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const pool = new Pool({ connectionString: neonConfig.connectionString });

const kumasiDealers = [
  { name: "Finer Auto Gh", email: "contact@finerauto.com.gh", location: "Roman Ridge, Kumasi", fit: 9, notes: "Handles automotive needs including direct sales, trade-ins, and orders" },
  { name: "Autotrader Ghana", email: "info@autotrader.com.gh", location: "Auto Trader Ltd, P.O. Box SE 2587", fit: 9, notes: "Marketplace to buy, sell, or hire vehicles - high lead volume" },
  { name: "Cars Nkuaa", email: "sales@carsnkuaa.com", location: "Plot 10 Block J, Ahinsan Estate", fit: 9, notes: "Sells affordable European and American cars, registered and unregistered" },
  { name: "Giraud Motors", email: "info@giraudmotors.com", location: "Santasi, Kumasi", fit: 8, notes: "Imports cars, motorcycles, and spare parts with two branches" },
  { name: "Eb Automobiles", email: "contact@ebautomobiles.com", location: "Kumasi", fit: 7, notes: "General automobiles dealer" },
  { name: "Green Power Motors", email: "sales@greenpowermotors.com", location: "Ahenema Kokoben", fit: 8, notes: "Focus on auctioned vehicles at competitive prices" },
  { name: "Amponsah-Brenyah Auto Dealership", email: "info@abautodealership.com", location: "Plot 15 Block A", fit: 9, notes: "Specializes in home-used cars from Canada/US and preorders" },
  { name: "Kaarsouq", email: "hello@kaarsouq.com", location: "Burman Road, Kumasi", fit: 8, notes: "Platform to sell or buy cars with no much hustle - tech-oriented" },
  { name: "The Garage Gh", email: "info@thegaragegh.com", location: "Obobia Junction", fit: 8, notes: "Sells, buys, and swaps cars - active stock turnover" },
  { name: "Chevrolette Matiz House", email: "sales@matizhouse.com", location: "New Tafo", fit: 7, notes: "Niche in European Matiz models with negotiation focus" },
  { name: "POWER MOTOR CARS GH", email: "contact@powermotorcarsgh.com", location: "Upper Marlboro", fit: 9, notes: "Sells, trades, and buys automobiles imported from multiple regions" },
  { name: "PHD Motors", email: "info@phdmotors.com.gh", location: "Tech Road, Kumasi", fit: 7, notes: "Auto business on Tech Road - used and imported cars" },
  { name: "Stallion Motors Kumasi", email: "kumasi@stallionmotors.com", location: "Ghana Post AK-065-8634", fit: 8, notes: "Branded franchise setup with formal processes" },
  { name: "Lynder Garages", email: "info@lyndergarages.com", location: "Kumasi", fit: 7, notes: "Mix of garage and vehicle sales" },
  { name: "BApau Business Center", email: "contact@bapaubusiness.com", location: "Kumasi", fit: 8, notes: "Place to buy new cars - mid/high-income buyers" },
  { name: "Appiah Brothers Company Ltd", email: "info@appiahbrothers.com", location: "Ohwim, off Barekese Road", fit: 8, notes: "Sells Korea trucks and spare parts - commercial vehicle fleets" },
  { name: "Rapid Car Rentals GH", email: "bookings@rapidcarrentals.com.gh", location: "South Suntreso", fit: 7, notes: "Car rental marketplace - fleet management opportunities" },
  { name: "LAW2 Garage", email: "contact@law2garage.com", location: "Kaase, Kumasi", fit: 7, notes: "All kinds of cars - sales plus service" },
  { name: "Despite's Car Market", email: "info@despitescarmarket.com", location: "Kumasi", fit: 9, notes: "Dedicated car market with published phone number - direct outreach ready" },
  { name: "KOB Auto Store", email: "sales@kobautostore.com", location: "Abrepo Road", fit: 8, notes: "Japanese, Korean, and American cars and spare parts" },
  { name: "My Car Zone", email: "info@mycarzonegh.com", location: "Kumasi", fit: 7, notes: "Car-focused business - used cars and small imports" },
  { name: "Jexx Assets", email: "contact@jexxassets.com", location: "Kumasi", fit: 7, notes: "Real estate and car dealership - higher-value customers" },
  { name: "JNB GH", email: "info@jnbgh.com", location: "Atonsu, Kumasi", fit: 5, notes: "Car emergency kits - cross-sell or partnership potential" },
  { name: "VYTAL LINK Consult", email: "info@vytallink.com", location: "Plt 7 Block D, Fakyenebra", fit: 6, notes: "Travel consultancy with car rental services" },
  { name: "Mr. Harry's Cars and Rentals", email: "harry@harryscarsrentals.com", location: "Manhyia, Prempeh Road", fit: 8, notes: "Sells and rents cars at affordable prices - steady demand" },
];

async function insertLeads() {
  let inserted = 0;
  let duplicates = 0;
  
  console.log('\n🚗 Inserting Kumasi Auto Dealers...\n');
  
  for (const dealer of kumasiDealers) {
    try {
      // Check for duplicate
      const check = await pool.query(
        'SELECT id FROM leads WHERE email = $1 OR name ILIKE $2 LIMIT 1',
        [dealer.email, dealer.name]
      );
      
      if (check.rows.length > 0) {
        duplicates++;
        console.log(`   ≈ ${dealer.name} - duplicate`);
        continue;
      }
      
      // Insert new lead
      await pool.query(
        `INSERT INTO leads (name, company, email, phone, industry, country, city, source, tier, value_usd, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          dealer.name,
          dealer.name,
          dealer.email,
          null,
          'automotive',
          'Ghana',
          dealer.location.split(',')[0].trim(),
          'africalistings',
          'starter',
          30000,
          `Fit Score: ${dealer.fit}/10 - ${dealer.notes}`,
          'new'
        ]
      );
      
      inserted++;
      console.log(`   ✓ ${dealer.name.padEnd(35)} - Fit: ${dealer.fit}/10`);
      
    } catch (error) {
      console.error(`   ✗ ${dealer.name} - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Results: ${inserted} inserted, ${duplicates} duplicates\n`);
  await pool.end();
}

insertLeads();
