import express from 'express';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { emitBroadcastUpdate, processBroadcast } from '../services/worker';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `b.company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `b.company_name = $${startingIndex}`, params: [compName] };
}

// 1. List Campaigns with Gateway & Template details (Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';

    const result = await query(
      `SELECT b.*, 
              wg.name as whatsapp_gateway_name, wg.quality_rating as whatsapp_quality,
              eg.name as email_gateway_name,
              wt.name as whatsapp_template_name,
              et.name as email_template_name,
              u.full_name as creator_name
       FROM campaign_broadcasts b
       LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
       LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
       LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
       LEFT JOIN campaign_templates et ON b.email_template_id = et.id
       LEFT JOIN users u ON b.created_by = u.id
       ${whereClause}
       ORDER BY b.created_at DESC`,
      compCond.params
    );

    const enriched = result.rows.map((b) => {
      let countdownSeconds = 0;
      if (b.status === 'scheduled' && b.scheduled_at) {
        const diffMs = new Date(b.scheduled_at).getTime() - Date.now();
        countdownSeconds = Math.max(0, Math.floor(diffMs / 1000));
        if (isNaN(countdownSeconds)) countdownSeconds = 0;
      }
      return {
        ...b,
        countdownSeconds,
        isCooldownActive: b.cooldown_until ? new Date(b.cooldown_until).getTime() > Date.now() : false,
      };
    });

    res.json({ success: true, campaigns: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create Broadcast Campaign from 6-Step Wizard
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    name,
    description,
    channel,
    tags,
    whatsapp_gateway_id,
    whatsapp_phone_number_id,
    email_gateway_id,
    whatsapp_template_id,
    email_template_id,
    audience_filters,
    total_audience,
    execution_mode,
    scheduled_at,
    company_name,
  } = req.body;

  if (!name || !channel) {
    res.status(400).json({ success: false, message: 'Campaign name and channel are required.' });
    return;
  }

  const assignedCompany = req.user?.role === 'superadmin'
    ? (company_name || 'OmniReach Global')
    : (req.user?.company_name || 'Independent Enterprise');

  try {
    const isImmediate = execution_mode === 'immediate' || !scheduled_at;
    const scheduleTime = isImmediate ? new Date() : new Date(scheduled_at);
    const initialStatus = 'scheduled';

    const insertRes = await query(
      `INSERT INTO campaign_broadcasts 
       (name, company_name, description, channel, tags, whatsapp_gateway_id, whatsapp_phone_number_id, email_gateway_id, whatsapp_template_id, email_template_id, audience_filters, total_target_count, status, execution_mode, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        name,
        assignedCompany,
        description || '',
        channel,
        tags || [],
        whatsapp_gateway_id || null,
        whatsapp_phone_number_id || null,
        email_gateway_id || null,
        whatsapp_template_id || null,
        email_template_id || null,
        JSON.stringify(audience_filters || {}),
        parseInt(total_audience, 10) || 0,
        initialStatus,
        execution_mode || 'immediate',
        scheduleTime,
        req.user!.id,
      ]
    );

    const newBroadcast = insertRes.rows[0];

    await logAdminAudit(
      req.user!.id,
      'CREATE_CAMPAIGN',
      'campaign_broadcasts',
      newBroadcast.id,
      { name, channel, execution_mode, company: assignedCompany },
      req.ip
    );

    emitBroadcastUpdate({ type: 'CAMPAIGN_CREATED', campaign: newBroadcast });

    res.json({ success: true, campaign: newBroadcast });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Single Campaign Details & Delivery Logs
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const broadcastRes = await query(
      `SELECT b.*, 
              wg.name as whatsapp_gateway_name, 
              eg.name as email_gateway_name,
              wt.name as whatsapp_template_name,
              et.name as email_template_name
       FROM campaign_broadcasts b
       LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
       LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
       LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
       LEFT JOIN campaign_templates et ON b.email_template_id = et.id
       WHERE b.id = $1`,
      [String(id)]
    );

    if (broadcastRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found.' });
      return;
    }

    const campaign = broadcastRes.rows[0];
    if (req.user?.role !== 'superadmin' && campaign.company_name !== req.user?.company_name) {
      res.status(403).json({ success: false, message: 'Access denied to this company campaign.' });
      return;
    }

    res.json({ success: true, campaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Get Campaign Logs
router.get('/:id/logs', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const isSuper = req.user?.role === 'superadmin';
    const compName = req.user?.company_name;

    // Verify campaign ownership
    const bcastRes = await query('SELECT company_name FROM campaign_broadcasts WHERE id = $1', [String(id)]);
    if (bcastRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found.' });
      return;
    }
    if (!isSuper && bcastRes.rows[0].company_name !== compName) {
      res.status(403).json({ success: false, message: 'Access denied to this campaign logs.' });
      return;
    }

    const logsRes = await query(
      `SELECT l.*, ml.full_name as lead_name, ml.urn as lead_urn, ml.fmcb_id as lead_fmcb_id
       FROM campaign_logs l
       LEFT JOIN campaign_master_leads ml ON l.master_lead_id = ml.id
       WHERE l.broadcast_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [String(id)]
    );

    res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Trigger Immediate Run / Re-run
router.post('/:id/run-now', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $2';
    const params = req.user?.role === 'superadmin' ? [String(id)] : [String(id), req.user?.company_name];

    const updateRes = await query(
      `UPDATE campaign_broadcasts 
       SET status = 'scheduled', scheduled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 ${compCond}
       RETURNING id`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found or access denied.' });
      return;
    }

    await logAdminAudit(req.user!.id, 'FORCE_RUN_CAMPAIGN', 'campaign_broadcasts', String(id), {}, req.ip);

    res.json({ success: true, message: 'Campaign scheduled for immediate poller dispatch.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Delete Campaign (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM campaign_broadcasts WHERE id = $1`, [String(id)]);
    await logAdminAudit(req.user!.id, 'DELETE_CAMPAIGN', 'campaign_broadcasts', String(id), {}, req.ip);

    res.json({ success: true, message: 'Campaign deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
