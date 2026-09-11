import { query } from './db';

async function seedTemplates() {
  try {
    await query(
      `INSERT INTO campaign_templates (name, channel, category, meta_template_name, meta_status, header_type, header_content, body_content, footer_content, buttons_json, email_subject, email_html, dynamic_tokens)
       VALUES 
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13),
       ($14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26),
       ($27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)`,
      [
        // Template 1: WhatsApp Pre-Approved Credit Card Offer
        'Pre-Approved Credit Card Broadcast',
        'whatsapp',
        'MARKETING',
        'omnireach_preapproved_card_v1',
        'APPROVED',
        'IMAGE',
        'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
        'Hello {name},\n\nCongratulations! Based on your customer profile (Ref: {id}), you have been pre-approved for an exclusive Lifetime-Free Card with up to ₹5,00,000 limit and 5% unlimited cashback.\n\nClick below to claim before it expires.',
        'OmniReach Enterprise Services • Verified Partner',
        JSON.stringify([
          { type: 'URL', text: 'Claim Offer Now 💳', url: 'https://omnireach.io/apply?lead={id}&utm_id=broadcast' },
          { type: 'QUICK_REPLY', text: 'Talk to Advisor 📞' },
          { type: 'QUICK_REPLY', text: 'Opt-out 🚫' },
        ]),
        null,
        null,
        JSON.stringify(['name', 'contact', 'id', 'unsubscribe_url', 'contact_center_url']),

        // Template 2: WhatsApp Loan Rate Slash Alert
        'Home & Personal Loan Interest Drop Alert',
        'whatsapp',
        'UTILITY',
        'omnireach_rate_drop_alert',
        'APPROVED',
        'TEXT',
        '🚨 Interest Rate Reduction Notification',
        'Dear {name},\n\nSpecial loan interest rates have been dropped to 8.35% p.a. for pre-qualified customers like you (Customer ID: {id}).\n\nTransfer your existing facility or apply for a fresh sanction with zero processing fee.',
        'Manage preferences: {contact_center_url}',
        JSON.stringify([
          { type: 'URL', text: 'Calculate Savings 📊', url: 'https://omnireach.io/emi-calc?lead={id}' },
          { type: 'QUICK_REPLY', text: 'Request Call Back' }
        ]),
        null,
        null,
        JSON.stringify(['name', 'contact', 'id', 'contact_center_url']),

        // Template 3: Email Responsive Newsletter & Offer
        'Exclusive Pre-Approved Financial Products',
        'email',
        'MARKETING',
        null,
        'APPROVED',
        'NONE',
        null,
        'Dear {name},\n\nWe are pleased to present your tailored enterprise offers for this quarter...',
        'OmniReach Enterprise Services',
        JSON.stringify([]),
        'Exclusive Pre-Approved Offers for {name} (Ref: {id})',
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">OmniReach Enterprise</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">OmniChannel Campaign Solutions</p>
  </div>
  <div style="padding: 30px 25px; color: #1e293b; line-height: 1.6;">
    <h2 style="color: #0f172a; font-size: 18px;">Hello {name},</h2>
    <p>We are delighted to inform you that your profile (Customer Reference: <strong>{id}</strong>) has qualified for pre-approved facilities with zero collateral and expedited sanctioning.</p>
    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #1e40af;">Offer Details:</p>
      <ul style="margin: 8px 0 0 20px; padding: 0;">
        <li>Sanction Limit: Up to ₹10,00,000</li>
        <li>Special Rate: 8.40% p.a.</li>
        <li>Contact Linked: {contact}</li>
      </ul>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://omnireach.io/apply?lead={id}&utm_campaign=email_broadcast" style="background: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate Offer in 2 Minutes</a>
    </div>
  </div>
  <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 10px 0;">You received this message because you are a registered customer of OmniReach Services.</p>
    <p style="margin: 0;">
      <a href="{contact_center_url}" style="color: #2563eb; text-decoration: underline; margin-right: 12px;">Manage Communication Preferences</a> | 
      <a href="{unsubscribe_url}" style="color: #64748b; text-decoration: underline; margin-left: 12px;">1-Click Unsubscribe</a>
    </p>
  </div>
</div>`,
        JSON.stringify(['name', 'contact', 'mail', 'id', 'unsubscribe_url', 'contact_center_url'])
      ]
    );
    console.log('✅ Templates seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding templates:', err);
    process.exit(1);
  }
}

seedTemplates();
