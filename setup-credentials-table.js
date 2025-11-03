const pool = require('./src/config/database');

async function setupCredentialsTable() {
  try {
    console.log('Creating staff_credentials table...');

    // Create staff_credentials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        plaintext_password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    console.log('✅ staff_credentials table created successfully');

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_credentials_user_id
      ON staff_credentials(user_id)
    `);

    console.log('✅ Index created successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up credentials table:', error);
    process.exit(1);
  }
}

setupCredentialsTable();
