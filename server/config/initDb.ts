import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { query, pool } from './db';

export async function initializeDatabase() {
  try {
    console.log('🚀 Initializing PostgreSQL BroadcastEngine database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schemaSql);
    console.log('✅ Database schema applied successfully.');

    // Safe Column Migrations
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';
      ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';
      ALTER TABLE gateways_config ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';
      ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';
      ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';
      ALTER TABLE journeys ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'OmniReach Global';

      ALTER TABLE gateways_config DROP CONSTRAINT IF EXISTS gateways_config_type_check;
      ALTER TABLE gateways_config ADD CONSTRAINT gateways_config_type_check CHECK (type IN ('whatsapp_meta', 'whatsapp_baileys', 'email_ses', 'email_smtp', 'email_resend'));
    `);

    // Seed/Verify Single Superadmin User (All other data starts completely clean from 0)
    const superadminEmail = 'SuplerLucky@gmail.com';
    const superadminPass = 'Lakshay@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(superadminPass, salt);

    const existingSuperadmin = await query(
      'SELECT id FROM users WHERE email = $1',
      [superadminEmail]
    );

    if (existingSuperadmin.rows.length === 0) {
      await query(
        `INSERT INTO users (email, password_hash, full_name, role, company_name, permissions, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          superadminEmail,
          passwordHash,
          'Super Lucky (Chief Superadmin)',
          'superadmin',
          'OmniReach Global',
          JSON.stringify({
            all_access: true,
            manage_admins: true,
            manage_gateways: true,
            manage_campaigns: true,
            manage_leads: true,
            manage_templates: true,
            view_audit_logs: true,
          }),
          true,
        ]
      );
      console.log(`👑 Superadmin verified: ${superadminEmail}`);
    } else {
      await query(
        `UPDATE users SET password_hash = $1, role = 'superadmin', company_name = 'OmniReach Global', is_active = true WHERE email = $2`,
        [passwordHash, superadminEmail]
      );
      console.log(`👑 Superadmin updated/verified: ${superadminEmail}`);
    }

    // Seed helpful Canned Responses if empty
    const cannedCheck = await query('SELECT count(*) FROM canned_responses');
    if (parseInt(cannedCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO canned_responses (company_name, shortcut, title, content, category)
        VALUES 
          ('OmniReach Global', '/hello', 'Warm Customer Greeting', 'Hello! Thank you for reaching out to us. How can our team assist you today?', 'greeting'),
          ('OmniReach Global', '/pricing', 'Enterprise Pricing Overview', 'Our enterprise communication plans start with unlimited contacts, real-time analytics, and multi-channel WhatsApp & SES delivery. Let us know your estimated volume to share a tailored quotation!', 'sales'),
          ('OmniReach Global', '/support', 'Technical Support Escalation', 'Thank you for providing the details. I have forwarded your request to our engineering concierge and will update you shortly.', 'support'),
          ('OmniReach Global', '/bye', 'Polite Issue Resolution', 'Glad we could resolve this for you! Please reply anytime if you need further assistance. Have a wonderful day ahead!', 'closing')
      `);
      console.log('💬 Default Canned Responses initialized.');
    }

    console.log('✨ Clean database ready with 0 prefixed/hardcoded mock data!');
  } catch (error) {
    console.error('❌ Error during database initialization:', error);
    throw error;
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database ready.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
