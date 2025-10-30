const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string from Neon
const connectionString = 'postgresql://neondb_owner:npg_CeUHFnP0D2oS@ep-autumn-river-adio3lqh-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function setupDatabase() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to Neon database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'src', 'config', 'database.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('🔄 Executing database schema...\n');

    // Execute the SQL
    await client.query(sql);

    console.log('✓ Database schema created successfully!');
    console.log('✓ Tables created: users, leave_types, leave_balances, leave_requests');
    console.log('✓ Indexes created for performance optimization');
    console.log('✓ Default leave types inserted');
    console.log('✓ Triggers created for automatic timestamp updates\n');

    console.log('📊 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n✅ Tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check leave types
    const leaveTypesResult = await client.query('SELECT name, days_per_year FROM leave_types ORDER BY name');
    console.log('\n✅ Leave types configured:');
    leaveTypesResult.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.days_per_year} days/year`);
    });

    console.log('\n🎉 Database setup complete! You can now start the backend server.');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
