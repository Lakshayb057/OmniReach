import express from 'express';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import {
  registerNewTemplateOnMeta,
  checkMetaTemplateLiveStatus,
  fetchAndSyncMetaTemplatesForCompany,
} from '../services/metaIntegrationService';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `company_name = $${startingIndex}`, params: [compName] };
}

// 1. Get All Templates (WhatsApp & Email - Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { channel } = req.query;
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    const compCond = getCompanyCondition(req, params.length + 1);
    if (compCond.clause) {
      conditions.push(compCond.clause);
      params.push(...compCond.params);
    }

    if (channel) {
      params.push(channel);
      conditions.push(`channel = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM campaign_templates ${whereClause} ORDER BY created_at DESC`,
      params
    );

    res.json({ success: true, templates: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create Template with Meta Graph API Direct Submission & Auto-Registration
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    name,
    channel,
    category,
    meta_template_name,
    meta_language,
    header_type,
    header_content,
    body_content,
    footer_content,
    buttons_json,
    email_subject,
    email_html,
    dynamic_tokens,
    company_name,
  } = req.body;

  if (!name || !channel || !body_content) {
    res.status(400).json({ success: false, message: 'Template name, channel, and body content are required.' });
    return;
  }

  const assignedCompany = req.user?.role === 'superadmin'
    ? (company_name || 'OmniReach Global')
    : (req.user?.company_name || 'Independent Enterprise');

  try {
    let metaStatus: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' = 'APPROVED';
    let metaSyncMessage = 'Template saved to database.';

    // If channel is WhatsApp, check if company has an active Meta Cloud API gateway
    if (channel === 'whatsapp') {
      const gwRes = await query(
        `SELECT * FROM gateways_config 
         WHERE company_name = $1 
           AND type = 'whatsapp_meta' AND is_active = true 
         ORDER BY is_default DESC LIMIT 1`,
        [assignedCompany]
      );
      const gw = gwRes.rows[0];

      if (gw && gw.credentials) {
        const metaReg = await registerNewTemplateOnMeta(gw.credentials, assignedCompany, {
          name,
          category,
          meta_language,
          header_type,
          header_content,
          body_content,
          footer_content,
          buttons_json,
        });

        metaStatus = metaReg.status;
        metaSyncMessage = metaReg.message;
      } else {
        metaStatus = 'APPROVED';
        metaSyncMessage = 'WhatsApp Template saved successfully for broadasting engine.';
      }
    }

    const defaultTokens = ['name', 'contact', 'mail', 'address', 'id', 'unsubscribe_url', 'contact_center_url'];

    const insertRes = await query(
      `INSERT INTO campaign_templates 
       (name, company_name, channel, category, meta_template_name, meta_language, meta_status, header_type, header_content, body_content, footer_content, buttons_json, email_subject, email_html, dynamic_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        name,
        assignedCompany,
        channel,
        category || 'MARKETING',
        meta_template_name || name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        meta_language || 'en_US',
        metaStatus,
        header_type || 'NONE',
        header_content || null,
        body_content,
        footer_content || null,
        JSON.stringify(buttons_json || []),
        email_subject || null,
        email_html || null,
        JSON.stringify(dynamic_tokens || defaultTokens),
      ]
    );

    const newTemplate = insertRes.rows[0];
    await logAdminAudit(
      req.user!.id,
      'CREATE_TEMPLATE',
      'campaign_templates',
      newTemplate.id,
      { name, channel, company: assignedCompany, meta_status: metaStatus },
      req.ip
    );

    res.json({ success: true, template: newTemplate, message: metaSyncMessage });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2B. Bulk Meta Cloud API Synchronizer
router.post('/sync-all', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const isSuper = req.user?.role === 'superadmin';
    const targetComp = req.body.company_name || req.query.company_name;

    let gwQuery = `SELECT * FROM gateways_config WHERE type = 'whatsapp_meta' AND is_active = true`;
    const gwParams: any[] = [];
    if (!isSuper) {
      gwQuery += ` AND company_name = $1`;
      gwParams.push(req.user?.company_name || 'Independent Enterprise');
    } else if (targetComp && targetComp !== 'all' && targetComp !== 'All Companies (Global)') {
      gwQuery += ` AND company_name = $1`;
      gwParams.push(targetComp);
    }

    const gateways = await query(gwQuery, gwParams);
    let totalSynced = 0;
    const reports: any[] = [];

    for (const gw of gateways.rows) {
      if (gw.credentials) {
        const syncRes = await fetchAndSyncMetaTemplatesForCompany(gw.credentials, gw.company_name);
        totalSynced += syncRes.totalSynced;
        reports.push(syncRes);
      }
    }

    res.json({
      success: true,
      message: `Meta WhatsApp Cloud API synchronized ${totalSynced} template(s) in real time for ${isSuper ? (targetComp || 'all companies') : req.user?.company_name}.`,
      totalSynced,
      reports,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Update Template
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const {
    name,
    category,
    meta_template_name,
    meta_language,
    header_type,
    header_content,
    body_content,
    footer_content,
    buttons_json,
    email_subject,
    email_html,
    dynamic_tokens,
  } = req.body;

  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $14';
    const params = [
      name,
      category,
      meta_template_name,
      meta_language,
      header_type,
      header_content,
      body_content,
      footer_content,
      buttons_json ? JSON.stringify(buttons_json) : null,
      email_subject,
      email_html,
      dynamic_tokens ? JSON.stringify(dynamic_tokens) : null,
      String(id),
    ];
    if (req.user?.role !== 'superadmin') {
      params.push(req.user?.company_name);
    }

    const updateRes = await query(
      `UPDATE campaign_templates 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           meta_template_name = COALESCE($3, meta_template_name),
           meta_language = COALESCE($4, meta_language),
           header_type = COALESCE($5, header_type),
           header_content = COALESCE($6, header_content),
           body_content = COALESCE($7, body_content),
           footer_content = COALESCE($8, footer_content),
           buttons_json = COALESCE($9, buttons_json),
           email_subject = COALESCE($10, email_subject),
           email_html = COALESCE($11, email_html),
           dynamic_tokens = COALESCE($12, dynamic_tokens),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 ${compCond}
       RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Template not found or access restricted.' });
      return;
    }

    await logAdminAudit(req.user!.id, 'UPDATE_TEMPLATE', 'campaign_templates', String(id), { name }, req.ip);

    res.json({ success: true, template: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Delete Template (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM campaign_templates WHERE id = $1`, [String(id)]);
    await logAdminAudit(req.user!.id, 'DELETE_TEMPLATE', 'campaign_templates', String(id), {}, req.ip);

    res.json({ success: true, message: 'Template deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Meta Graph API Real-Time Status Sync & Verification
router.post('/:id/sync-meta', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const tmplRes = await query('SELECT * FROM campaign_templates WHERE id = $1', [String(id)]);
    if (tmplRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Template not found.' });
      return;
    }
    const tmpl = tmplRes.rows[0];

    // Look up company's WhatsApp gateway
    const gwRes = await query(
      `SELECT * FROM gateways_config 
       WHERE (company_name = $1 OR company_name = 'OmniReach Global') 
         AND type LIKE 'whatsapp%' AND is_active = true 
       ORDER BY (company_name = $1) DESC, is_default DESC LIMIT 1`,
      [tmpl.company_name]
    );
    const gw = gwRes.rows[0];

    let liveStatus = 'APPROVED';
    let statusMsg = 'Template verified in real time.';

    if (gw && gw.credentials) {
      const liveCheck = await checkMetaTemplateLiveStatus(
        gw.credentials,
        tmpl.meta_template_name || tmpl.name
      );
      liveStatus = liveCheck.status;
      statusMsg = liveCheck.message;
    }

    const updatedRes = await query(
      `UPDATE campaign_templates 
       SET meta_status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [liveStatus, String(id)]
    );

    res.json({
      success: true,
      template: updatedRes.rows[0],
      meta_status: liveStatus,
      message: statusMsg,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
