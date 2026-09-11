import express from 'express';
import { query } from '../config/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number = 1): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }

  // Regular Admin is strictly scoped to their assigned company
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `company_name = $${startingIndex}`, params: [compName] };
}

// 1. Dashboard KPI Summary Cards & Filter Aggregations
router.get('/kpis', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { date_from, date_to } = req.query;

  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (date_from && date_to) {
      params.push(date_from, date_to);
      conditions.push(`created_at BETWEEN $1 AND $2`);
    }

    const compCond = getCompanyCondition(req, params.length + 1);
    if (compCond.clause) {
      conditions.push(compCond.clause);
      params.push(...compCond.params);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // A. Campaign Counts
    const campaignStatsRes = await query(
      `SELECT 
         COUNT(*) as total_campaigns,
         COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_campaigns,
         COUNT(*) FILTER (WHERE status = 'processing') as active_campaigns,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_campaigns,
         COALESCE(SUM(total_target_count), 0) as total_targeted,
         COALESCE(SUM(whatsapp_sent + email_sent), 0) as total_sent,
         COALESCE(SUM(whatsapp_delivered + email_delivered), 0) as total_delivered,
         COALESCE(SUM(whatsapp_read + email_opened), 0) as total_read,
         COALESCE(SUM(whatsapp_failed + email_failed), 0) as total_failed,
         COALESCE(SUM(total_suppressed), 0) as total_suppressed,
         COALESCE(SUM(total_clicks), 0) as total_clicks
       FROM campaign_broadcasts
       ${whereClause}`,
      params
    );

    const stats = campaignStatsRes.rows[0];
    const totalSent = parseInt(stats.total_sent) || 0;
    const totalDelivered = parseInt(stats.total_delivered) || 0;
    const totalClicks = parseInt(stats.total_clicks) || 0;

    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
    const ctrRate = totalDelivered > 0 ? ((totalClicks / totalDelivered) * 100).toFixed(1) : '0.0';

    // B. Master Leads Opt-In / Opt-Out Stats
    let leadWhereClause = '';
    const leadParams: any[] = [];
    const leadCompCond = getCompanyCondition(req, 1);
    if (leadCompCond.clause) {
      leadWhereClause = `WHERE ${leadCompCond.clause}`;
      leadParams.push(...leadCompCond.params);
    }

    const optInStatsRes = await query(
      `SELECT 
         COUNT(*) as total_contacts,
         COUNT(*) FILTER (WHERE whatsapp_optin = true) as whatsapp_optin_count,
         COUNT(*) FILTER (WHERE whatsapp_optin = false) as whatsapp_optout_count,
         COUNT(*) FILTER (WHERE email_optin = true) as email_optin_count,
         COUNT(*) FILTER (WHERE email_optin = false) as email_optout_count
       FROM campaign_master_leads
       ${leadWhereClause}`,
      leadParams
    );

    const optStats = optInStatsRes.rows[0];

    res.json({
      success: true,
      active_company: req.user?.role === 'superadmin' ? (req.query.company_name || 'All Companies (Global)') : req.user?.company_name,
      data: {
        summary: {
          totalCampaigns: parseInt(stats.total_campaigns) || 0,
          scheduledCampaigns: parseInt(stats.scheduled_campaigns) || 0,
          activeCampaigns: parseInt(stats.active_campaigns) || 0,
          completedCampaigns: parseInt(stats.completed_campaigns) || 0,
          targetedAudienceCount: parseInt(stats.total_targeted) || parseInt(optStats.total_contacts) || 0,
          deliveryRate: parseFloat(deliveryRate),
          clickThroughRate: parseFloat(ctrRate),
          totalClicks: parseInt(stats.total_clicks) || 0,
          totalSuppressed: parseInt(stats.total_suppressed) || 0,
        },
        optInMetrics: {
          totalContacts: parseInt(optStats.total_contacts) || 0,
          whatsappOptIn: parseInt(optStats.whatsapp_optin_count) || 0,
          whatsappOptOut: parseInt(optStats.whatsapp_optout_count) || 0,
          emailOptIn: parseInt(optStats.email_optin_count) || 0,
          emailOptOut: parseInt(optStats.email_optout_count) || 0,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Channel Performance Funnel Data
router.get('/funnel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';

    const resSummary = await query(
      `SELECT 
         COALESCE(SUM(whatsapp_sent + email_sent), 0) as sent,
         COALESCE(SUM(whatsapp_delivered + email_delivered), 0) as delivered,
         COALESCE(SUM(whatsapp_read + email_opened), 0) as read_opened,
         COALESCE(SUM(total_clicks), 0) as clicked,
         COALESCE(SUM(whatsapp_failed + email_failed), 0) as failed,
         COALESCE(SUM(total_suppressed), 0) as suppressed
       FROM campaign_broadcasts
       ${whereClause}`,
      compCond.params
    );

    const row = resSummary.rows[0];
    const sent = parseInt(row.sent) || 0;
    const delivered = parseInt(row.delivered) || 0;
    const read = parseInt(row.read_opened) || 0;
    const clicked = parseInt(row.clicked) || 0;
    const failed = parseInt(row.failed) || 0;

    const funnel = [
      { step: 'Sent', count: sent, percentage: sent > 0 ? 100 : 0, color: '#3b82f6' },
      { step: 'Delivered', count: delivered, percentage: sent > 0 ? Math.round((delivered / sent) * 100) : 0, color: '#10b981' },
      { step: 'Read / Opened', count: read, percentage: sent > 0 ? Math.round((read / sent) * 100) : 0, color: '#8b5cf6' },
      { step: 'Clicked (CTR)', count: clicked, percentage: sent > 0 ? Math.round((clicked / sent) * 100) : 0, color: '#f59e0b' },
      { step: 'Failed / Bounced', count: failed, percentage: sent > 0 ? Math.round((failed / sent) * 100) : 0, color: '#ef4444' },
    ];

    res.json({ success: true, funnel });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Live Broadcast Activity Feed & Reverse Countdown Timers
router.get('/live-feed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE b.${compCond.clause}` : '';

    const broadcastsRes = await query(
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
       ORDER BY b.created_at DESC
       LIMIT 20`,
      compCond.params
    );

    const enriched = broadcastsRes.rows.map((b) => {
      let countdownSeconds = 0;
      if (b.status === 'scheduled' && b.scheduled_at) {
        const diffMs = new Date(b.scheduled_at).getTime() - Date.now();
        countdownSeconds = Math.max(0, Math.floor(diffMs / 1000));
      }

      return {
        ...b,
        countdownSeconds,
        isCooldownActive: b.cooldown_until ? new Date(b.cooldown_until).getTime() > Date.now() : false,
      };
    });

    res.json({ success: true, feed: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
