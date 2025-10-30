const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Admin credentials
const ADMIN_EMAIL = 'admin@lifehospital.com';
const ADMIN_PASSWORD = 'admin123'; // Change this to a secure password
const ADMIN_NAME = 'System Administrator';
const ADMIN_DEPARTMENT = 'Administration';

async function createAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✓ Connected!\n');

    // Check if admin already exists
    const existingAdmin = await client.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('ℹ️  Admin user already exists:');
      console.log(`   Email: ${existingAdmin.rows[0].email}`);
      console.log(`   Name: ${existingAdmin.rows[0].name}`);
      console.log('\n💡 You can log in with these credentials on the frontend.');
      await client.end();
      return;
    }

    // Hash the password
    console.log('🔄 Creating admin user...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    // Create admin user
    const result = await client.query(
      `INSERT INTO users (name, email, password, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department`,
      [ADMIN_NAME, ADMIN_EMAIL, hashedPassword, 'admin', ADMIN_DEPARTMENT]
    );

    const admin = result.rows[0];

    // Initialize leave balances for admin
    const currentYear = new Date().getFullYear();
    const leaveTypes = await client.query('SELECT id, days_per_year FROM leave_types');

    for (const leaveType of leaveTypes.rows) {
      await client.query(
        'INSERT INTO leave_balances (user_id, leave_type_id, total_days, used_days, remaining_days, year) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, leaveType.id, leaveType.days_per_year, 0, leaveType.days_per_year, currentYear]
      );
    }

    console.log('✅ Admin user created successfully!\n');
    console.log('📋 Admin Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Name:     ${ADMIN_NAME}`);
    console.log(`   Role:     ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 You can now log in at: http://localhost:5176/login');
    console.log('🔐 After logging in, navigate to: http://localhost:5176/admin\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.detail) console.error('Details:', error.detail);
  } finally {
    await client.end();
  }
}

createAdmin();
