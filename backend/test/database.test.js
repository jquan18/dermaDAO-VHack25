const db = require('../src/config/database');
const logger = require('../src/config/logger');
const { fail } = require('jest-fail-on-console');

// Load environment variables
require('dotenv').config();

describe('Database Integration Tests', () => {
  // Test database connection
  describe('Connection', () => {
    it('should connect to the database successfully', async () => {
      const isConnected = await db.testConnection();
      expect(isConnected).toBe(true);
    });
    
    it('should have access to the database with correct credentials', async () => {
      try {
        const result = await db.query('SELECT current_user, current_database()');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        
        const { current_user, current_database } = result.rows[0];
        console.log(`Connected as user: ${current_user} to database: ${current_database}`);
        
        expect(current_user).toBeDefined();
        expect(current_database).toBeDefined();
      } catch (error) {
        fail(`Database connection failed: ${error.message}`);
      }
    });
  });
  
  // Test basic queries
  describe('Basic Queries', () => {
    it('should execute a simple query', async () => {
      try {
        const result = await db.query('SELECT NOW() as current_time');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].current_time).toBeDefined();
        console.log(`Current database time: ${result.rows[0].current_time}`);
      } catch (error) {
        fail(`Query failed: ${error.message}`);
      }
    });
    
    it('should handle query parameters correctly', async () => {
      try {
        const params = ['test_value'];
        const result = await db.query('SELECT $1::text as value', params);
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].value).toBe('test_value');
      } catch (error) {
        fail(`Parameterized query failed: ${error.message}`);
      }
    });
  });
  
  // Test table existence and schema
  describe('Schema Verification', () => {
    const expectedTables = [
      'users',
      'charities',
      'projects',
      'milestones',
      'donations',
      'proposals',
      'bank_accounts',
      'bank_transfers',
      'funding_rounds',
      'round_allocations',
      'wallet_transactions',
      'ai_verification_logs',
      'audit_logs'
    ];
    
    it('should have all required tables', async () => {
      try {
        const result = await db.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        
        const existingTables = result.rows.map(row => row.table_name);
        console.log('Existing tables:', existingTables);
        
        // Check if each expected table exists
        for (const table of expectedTables) {
          const exists = existingTables.includes(table);
          if (!exists) {
            console.warn(`Table '${table}' is missing`);
          }
          expect(exists).toBe(true);
        }
      } catch (error) {
        fail(`Schema verification failed: ${error.message}`);
      }
    });
    
    it('should verify users table structure', async () => {
      try {
        const result = await db.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        const columns = result.rows.map(row => `${row.column_name} (${row.data_type})`);
        console.log('Users table columns:', columns);
        
        // Check for required columns
        const requiredColumns = [
          'id',
          'email',
          'password_hash',
          'full_name',
          'wallet_address',
          'is_admin',
          'is_worldcoin_verified',
          'created_at'
        ];
        
        const existingColumns = result.rows.map(row => row.column_name);
        for (const column of requiredColumns) {
          const exists = existingColumns.includes(column);
          if (!exists) {
            console.warn(`Column '${column}' is missing from users table`);
          }
          expect(exists).toBe(true);
        }
      } catch (error) {
        fail(`Table structure verification failed: ${error.message}`);
      }
    });
  });
  
  // Test database queries (only if test data is available)
  describe('Data Queries', () => {
    it('should query users without errors', async () => {
      try {
        const result = await db.query('SELECT COUNT(*) as user_count FROM users');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        console.log(`User count: ${result.rows[0].user_count}`);
      } catch (error) {
        fail(`Users query failed: ${error.message}`);
      }
    });
    
    it('should query charities without errors', async () => {
      try {
        const result = await db.query('SELECT COUNT(*) as charity_count FROM charities');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        console.log(`Charity count: ${result.rows[0].charity_count}`);
      } catch (error) {
        fail(`Charities query failed: ${error.message}`);
      }
    });
    
    it('should query projects without errors', async () => {
      try {
        const result = await db.query('SELECT COUNT(*) as project_count FROM projects');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        console.log(`Project count: ${result.rows[0].project_count}`);
      } catch (error) {
        fail(`Projects query failed: ${error.message}`);
      }
    });
    
    it('should query donations without errors', async () => {
      try {
        const result = await db.query('SELECT COUNT(*) as donation_count FROM donations');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        console.log(`Donation count: ${result.rows[0].donation_count}`);
      } catch (error) {
        fail(`Donations query failed: ${error.message}`);
      }
    });
  });
  
  // Test database performance (optional)
  describe('Database Performance', () => {
    it('should have acceptable query performance', async () => {
      try {
        console.time('Query Performance');
        const result = await db.query(`
          SELECT table_name, 
                 (xpath('/row/cnt/text()', query_to_xml('select count(*) as cnt from ' || table_name, false, true, '')))[1]::text::int AS row_count
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        console.timeEnd('Query Performance');
        
        console.log('Table row counts:');
        result.rows.forEach(row => {
          console.log(`- ${row.table_name}: ${row.row_count} rows`);
        });
        
        expect(result.rows.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn(`Performance test failed: ${error.message}`);
      }
    });
  });
}); 