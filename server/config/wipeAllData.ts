import { pool, query } from './db';
import bcrypt from 'bcryptjs';

async function wipeDatabaseCompletely() {
  console.log('🧹 Starting complete database data wipe...');
  try {
    // 1. Truncate all data tables
    await query('TRUNCATE TABLE campaign_broadcasts CASCADE;');
    await query('TRUNCATE TABLE campaign_master_leads CASCADE;');
    await query('TRUNCATE TABLE campaign_templates CASCADE;');
    await query('TRUNCATE TABLE gateways_config CASCADE;');
    await query('TRUNCATE TABLE journeys CASCADE;');
    await query('TRUNCATE TABLE leads_repository CASCADE;');
    await query('TRUNCATE TABLE admin_audit_logs CASCADE;');

    // 2. Clear all users except superadmin
    await query("DELETE FROM users WHERE email != 'SuplerLucky@gmail.com';");

    // 3. Ensure Superadmin exists with exact credentials
    const superadminEmail = 'SuplerLucky@gmail.com';
    const superadminPass = 'Lakshay@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(superadminPass, salt);

    const check = await query('SELECT id FROM users WHERE email = $1', [superadminEmail]);
    if (check.rows.length === 0) {
      await query(
        `INSERT INTO users (email, password_hash, full_name, role, company_name, permissions, is_active)
         VALUES ($1, $2, 'Super Lucky (Chief Superadmin)', 'superadmin', 'OmniReach Global', $3, true)`,
        [
          superadminEmail,
          passwordHash,
          JSON.stringify({
            all_access: true,
            manage_admins: true,
            manage_gateways: true,
            manage_campaigns: true,
            manage_leads: true,
            manage_templates: true,
            view_audit_logs: true,
          }),
        ]
      );
    } else {
      await query(
        `UPDATE users SET password_hash = $1, role = 'superadmin', company_name = 'OmniReach Global', is_active = true WHERE email = $2`,
        [passwordHash, superadminEmail]
      );
    }

    console.log('✅ All data wiped successfully! Only Superadmin is preserved.');
    console.log('📊 Table counts:');
    const t1 = await query('SELECT count(*) FROM campaign_master_leads');
    const t2 = await query('SELECT count(*) FROM campaign_broadcasts');
    const t3 = await query('SELECT count(*) FROM campaign_templates');
    const t4 = await query('SELECT count(*) FROM gateways_config');
    const t5 = await query('SELECT count(*) FROM journeys');
    const t6 = await query('SELECT count(*) FROM users');
    console.log(`- Master Leads: ${t1.rows[0].count}`);
    console.log(`- Broadcasts: ${t2.rows[0].count}`);
    console.log(`- Templates: ${t3.rows[0].count}`);
    console.log(`- Gateways: ${t4.rows[0].count}`);
    console.log(`- Journeys: ${t5.rows[0].count}`);
    console.log(`- Users: ${t6.rows[0].count} (Superadmin only)`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error wiping database:', err);
    process.exit(1);
  }
}

wipeDatabaseCompletely();
