import { pool, query } from './config/db';
import { initializeDatabase } from './config/initDb';

async function wipeAllData() {
  console.log('🧹 Initiating COMPLETE PostgreSQL Database Wipe...');

  try {
    // 1. Truncate all tables with CASCADE
    await pool.query(`
      TRUNCATE TABLE 
        campaign_logs, 
        ctr_clicks, 
        admin_audit_logs, 
        journey_step_logs, 
        journey_enrollments, 
        journeys, 
        campaign_broadcasts, 
        campaign_templates, 
        gateways_config, 
        campaign_master_leads, 
        leads_repository, 
        users 
      CASCADE;
    `);
    console.log('✅ All application tables truncated successfully.');

    // 2. Reset Sequence to 1
    await pool.query('ALTER SEQUENCE IF EXISTS fmcb_id_seq RESTART WITH 1;');
    console.log('✅ FMCB ID sequential counter reset to 1.');

    // 3. Re-initialize Superadmin user
    await initializeDatabase();

    // 4. Verify database counts
    console.log('\n📊 Verifying Clean Database State:');
    const tables = [
      'leads_repository',
      'campaign_master_leads',
      'gateways_config',
      'campaign_templates',
      'campaign_broadcasts',
      'campaign_logs',
      'ctr_clicks',
      'admin_audit_logs',
      'journeys',
      'journey_enrollments',
      'journey_step_logs',
      'users',
    ];

    for (const table of tables) {
      const res = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   • ${table.padEnd(25)} : ${res.rows[0].count} record(s)`);
    }

    console.log('\n========================================================');
    console.log('✨ ALL DATABASE DATA WIPED CLEAN SUCCESSFULLY!');
    console.log('👑 Superadmin Ready: SuplerLucky@gmail.com / Lakshay@123');
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error wiping database:', err);
    process.exit(1);
  }
}

wipeAllData();
