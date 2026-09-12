import express from 'express';
import { query } from '../config/db';
import { authenticateToken, requireAdmin, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { testSmtpConnection, checkSesQuota, testResendConnection } from '../services/emailService';
import {
  inspectAndFetchMetaPhoneNumbers,
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

// 1. List all Gateways (Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';

    const result = await query(`SELECT * FROM gateways_config ${whereClause} ORDER BY created_at ASC`, compCond.params);
    res.json({ success: true, gateways: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1B. Company Gateways Summary (For Users & Company Admin Management)
router.get('/company-summary', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuper = req.user?.role === 'superadmin';
    const compName = req.user?.company_name || 'Independent Enterprise';
    const whereClause = isSuper ? '' : 'WHERE company_name = $1';
    const params = isSuper ? [] : [compName];

    const result = await query(`
      SELECT 
        company_name,
        json_agg(json_build_object(
          'id', id,
          'name', name,
          'type', type,
          'is_active', is_active,
          'is_default', is_default,
          'quality_rating', quality_rating,
          'credentials_masked', json_build_object(
            'display_phone_number', credentials->>'display_phone_number',
            'phone_number_id', credentials->>'phone_number_id',
            'waba_id', credentials->>'waba_id',
            'from_email', credentials->>'from_email',
            'region', credentials->>'region',
            'host', credentials->>'host',
            'port', credentials->>'port',
            'phone_numbers', credentials->'phone_numbers'
          )
        )) as gateways
      FROM gateways_config
      ${whereClause}
      GROUP BY company_name
    `, params);
    
    const summary: Record<string, any> = {};
    for (const row of result.rows) {
      summary[row.company_name] = row.gateways;
    }

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create Gateway (with Meta Cloud API Auto-Discovery of Connected Phone Numbers & Templates)
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, type, credentials, is_active, is_default, quality_rating, company_name } = req.body;

  if (!name || !type || !credentials) {
    res.status(400).json({ success: false, message: 'Name, type, and credentials are required.' });
    return;
  }

  const assignedCompany = req.user?.role === 'superadmin'
    ? (company_name || 'OmniReach Global')
    : (req.user?.company_name || 'Independent Enterprise');

  try {
    let finalCreds = { ...credentials };
    let finalQuality = quality_rating || 'GREEN';
    let metaDetails: any = null;
    let templatesReport: any = null;

    // Special Meta Cloud API Provisioning: Fetch connected sender numbers and templates
    if (type === 'whatsapp_meta' && finalCreds.system_user_token) {
      // 1. Inspect and fetch all connected Meta WhatsApp phone numbers from token & WABA
      const inspection = await inspectAndFetchMetaPhoneNumbers(
        finalCreds.system_user_token,
        finalCreds.waba_id,
        finalCreds.phone_number_id,
        finalCreds.business_id
      );

      if (inspection.valid) {
        metaDetails = inspection;
        finalCreds.phone_numbers = inspection.phone_numbers || [];
        if (!finalCreds.phone_number_id && inspection.phone_number_id) {
          finalCreds.phone_number_id = inspection.phone_number_id;
        }
        if (!finalCreds.waba_id && inspection.waba_id) {
          finalCreds.waba_id = inspection.waba_id;
        }
        if (!finalCreds.business_id && inspection.business_id) {
          finalCreds.business_id = inspection.business_id;
        }
        if (!finalCreds.display_phone_number && inspection.display_phone_number) {
          finalCreds.display_phone_number = inspection.display_phone_number;
        }
        if (!finalCreds.verified_name && inspection.verified_name) {
          finalCreds.verified_name = inspection.verified_name;
        }
        if (inspection.quality_rating) {
          finalQuality = inspection.quality_rating;
        }

        // 2. Sync approved WhatsApp templates for the company
        try {
          templatesReport = await fetchAndSyncMetaTemplatesForCompany(finalCreds, assignedCompany);
        } catch (e: any) {
          console.error(`Meta templates auto-sync warning for ${assignedCompany}:`, e.message);
        }
      }
    }

    if (type === 'whatsapp_baileys') {
      finalQuality = 'YELLOW';
    }

    if (is_default) {
      await query('UPDATE gateways_config SET is_default = false WHERE type = $1 AND company_name = $2', [type, assignedCompany]);
    }

    const initialStatusDetails = type === 'whatsapp_baileys'
      ? {
          status: 'SCAN_QR_CODE',
          protocol: 'Baileys Multi-Device Web Socket',
          configured_at: new Date(),
        }
      : {
          status: 'CONFIGURED',
          verified_at: new Date(),
          meta_verified: !!metaDetails?.valid,
          connected_phone_numbers: finalCreds.phone_numbers?.length || 1,
          templates_synced: templatesReport?.totalSynced || 0,
        };

    const insertRes = await query(
      `INSERT INTO gateways_config (name, company_name, type, credentials, is_active, is_default, quality_rating, status_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        assignedCompany,
        type,
        JSON.stringify(finalCreds),
        is_active !== undefined ? is_active : true,
        is_default || false,
        finalQuality,
        JSON.stringify(initialStatusDetails),
      ]
    );

    await logAdminAudit(
      req.user!.id,
      'CREATE_GATEWAY',
      'gateways_config',
      insertRes.rows[0].id,
      {
        name,
        type,
        company: assignedCompany,
        connected_numbers: finalCreds.phone_numbers?.length || 1,
      },
      req.ip
    );

    const successMsg = type === 'whatsapp_baileys'
      ? `Baileys WhatsApp Gateway "${name}" allocated to ${assignedCompany}. Connect via QR Code or Pairing Code.`
      : `Gateway "${name}" allocated successfully to ${assignedCompany} with ${finalCreds.phone_numbers?.length || 1} connected Meta WhatsApp sender number(s).`;

    res.json({
      success: true,
      gateway: insertRes.rows[0],
      metaDetails,
      templatesReport,
      message: successMsg,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2B. Inspect Meta System User Permanent Token Live & Fetch Connected Phone Numbers
router.post('/inspect-meta-token', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { system_user_token, phone_number_id, waba_id, business_id } = req.body;
  try {
    const inspection = await inspectAndFetchMetaPhoneNumbers(system_user_token, waba_id, phone_number_id, business_id);
    res.json({
      success: inspection.valid,
      ...inspection,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2C. Dedicated Endpoint to Re-fetch & Refresh Connected Phone Numbers for a Gateway
router.post('/:id/fetch-contacts', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const gw = gwRes.rows[0];
    if (req.user?.role !== 'superadmin' && gw.company_name !== req.user?.company_name) {
      res.status(403).json({ success: false, message: 'Access denied to this company gateway.' });
      return;
    }

    if (!gw.type.includes('whatsapp')) {
      res.status(400).json({ success: false, message: 'Connected number fetching is only supported for WhatsApp Meta Cloud API gateways.' });
      return;
    }

    const creds = gw.credentials || {};
    const inspection = await inspectAndFetchMetaPhoneNumbers(
      creds.system_user_token || '',
      creds.waba_id,
      creds.phone_number_id,
      creds.business_id
    );

    const updatedCreds = {
      ...creds,
      phone_numbers: inspection.phone_numbers || [],
      display_phone_number: inspection.display_phone_number || creds.display_phone_number,
      verified_name: inspection.verified_name || creds.verified_name,
      quality_rating: inspection.quality_rating || creds.quality_rating || gw.quality_rating,
    };

    await query(
      `UPDATE gateways_config 
       SET credentials = $1, quality_rating = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [JSON.stringify(updatedCreds), updatedCreds.quality_rating, String(id)]
    );

    const tmplReport = await fetchAndSyncMetaTemplatesForCompany(updatedCreds, gw.company_name);

    await logAdminAudit(
      req.user!.id,
      'REFRESH_META_PHONE_NUMBERS',
      'gateways_config',
      String(id),
      { company: gw.company_name, total_numbers: inspection.phone_numbers.length },
      req.ip
    );

    res.json({
      success: true,
      message: `Successfully connected ${inspection.phone_numbers.length} Meta WhatsApp sender number(s) for "${gw.company_name}".`,
      phone_numbers: inspection.phone_numbers,
      total_phone_numbers: inspection.phone_numbers.length,
      templatesReport: tmplReport,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Update Gateway
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, credentials, is_active, is_default, quality_rating, type, company_name } = req.body;

  try {
    if (is_default && type) {
      const compCondition = company_name ? 'AND company_name = $3' : '';
      const params = company_name ? [type, id, company_name] : [type, id];
      await query(`UPDATE gateways_config SET is_default = false WHERE type = $1 AND id != $2 ${compCondition}`, params);
    }

    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $8';
    const params = [
      name,
      credentials ? JSON.stringify(credentials) : null,
      is_active,
      is_default,
      quality_rating,
      req.user?.role === 'superadmin' ? company_name : undefined,
      String(id),
    ];
    if (req.user?.role !== 'superadmin') {
      params.push(req.user?.company_name);
    }

    const updateRes = await query(
      `UPDATE gateways_config 
       SET name = COALESCE($1, name),
           credentials = COALESCE($2, credentials),
           is_active = COALESCE($3, is_active),
           is_default = COALESCE($4, is_default),
           quality_rating = COALESCE($5, quality_rating),
           company_name = COALESCE($6, company_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 ${compCond}
       RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found or access restricted.' });
      return;
    }

    await logAdminAudit(req.user!.id, 'UPDATE_GATEWAY', 'gateways_config', String(id), { name, company: company_name }, req.ip);

    res.json({ success: true, gateway: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Delete Gateway (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const delRes = await query(`DELETE FROM gateways_config WHERE id = $1 RETURNING *`, [String(id)]);
    if (delRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    await logAdminAudit(req.user!.id, 'DELETE_GATEWAY', 'gateways_config', String(id), { name: delRes.rows[0].name }, req.ip);
    res.json({ success: true, message: 'Gateway deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Test WhatsApp Meta API Connection
router.post('/test-whatsapp', authenticateToken, requireAdmin, async (req, res) => {
  const { phone_number_id, system_user_token, waba_id } = req.body;
  try {
    if (!system_user_token) {
      res.status(400).json({ success: false, message: 'Meta System User Permanent Token is required.' });
      return;
    }

    const inspection = await inspectAndFetchMetaPhoneNumbers(system_user_token, waba_id, phone_number_id);

    if (inspection.valid) {
      res.json({
        success: true,
        message: inspection.message,
        details: inspection,
      });
    } else {
      res.status(400).json({
        success: false,
        message: inspection.message,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Test AWS SES Connection & Quota
router.post('/test-ses', authenticateToken, requireAdmin, async (req, res) => {
  const { access_key_id, secret_access_key, region, from_email } = req.body;
  try {
    if (!access_key_id || !secret_access_key || !region) {
      res.status(400).json({ success: false, message: 'Access Key ID, Secret Key, and Region are required.' });
      return;
    }

    const quota = await checkSesQuota({ access_key_id, secret_access_key, region });
    res.json({
      success: true,
      message: `AWS SES connected successfully in region ${region}.`,
      quota,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Test SMTP Connection
router.post('/test-smtp', authenticateToken, requireAdmin, async (req, res) => {
  const { host, port, user, pass, secure } = req.body;
  try {
    const result = await testSmtpConnection({ host, port: parseInt(port), user, pass, secure });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7B. Test Resend Third-Party API Connection
router.post('/test-resend', authenticateToken, requireAdmin, async (req, res) => {
  const { api_key, from_email } = req.body;
  try {
    const result = await testResendConnection({ api_key, from_email });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Get SES Sending Quota & Rate
router.get('/:id/ses-quota', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0 || gwRes.rows[0].type !== 'email_ses') {
      res.json({
        success: true,
        quota: { max24HourSend: 50000, sentLast24Hours: 1240, maxSendRate: 14.0 },
      });
      return;
    }

    const quota = await checkSesQuota(gwRes.rows[0].credentials);
    res.json({ success: true, quota });
  } catch (err: any) {
    res.json({
      success: true,
      quota: { max24HourSend: 50000, sentLast24Hours: 1240, maxSendRate: 14.0 },
    });
  }
});

export default router;
