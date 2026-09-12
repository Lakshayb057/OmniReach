import { Server as SocketIOServer } from 'socket.io';
import { query, pool } from '../config/db';
import { sendWhatsAppMessage } from './whatsappService';
import { sendEmailMessage } from './emailService';
import { LeadContext } from './tokenService';
import {
  calculatePacingDelay,
  checkAndIncrementDailyCount,
  DEFAULT_ANTI_BAN_SETTINGS,
  AntiBanSettings,
} from './antiBanService';
import { buildSearchClauses } from '../routes/leadsRoutes';

let ioInstance: SocketIOServer | null = null;
let isWorkerRunning = false;

// Active Dispatch Tracking for Play/Pause Control
export const activeDispatchers = new Map<string, { pauseRequested: boolean }>();

export function requestPauseBroadcast(broadcastId: string) {
  const disp = activeDispatchers.get(broadcastId);
  if (disp) {
    disp.pauseRequested = true;
  }
}

export function requestResumeBroadcast(broadcastId: string) {
  const disp = activeDispatchers.get(broadcastId);
  if (disp) {
    disp.pauseRequested = false;
  }
}

export function setSocketIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function emitBroadcastUpdate(data: any) {
  if (ioInstance) {
    ioInstance.emit('BROADCAST_UPDATED', data);
  }
}

import { processJourneyEnrollments } from './journeyEngine';

/**
 * 5-second Poller Worker Loop
 */
export function startBackgroundWorker(intervalMs: number = 5000) {
  console.log('⚡ Background Dispatch Worker initialized (5s poller)...');

  // Recover any stuck 'processing' broadcasts from previous crash or restart to 'paused'
  query(`
    UPDATE campaign_broadcasts 
    SET status = 'paused', updated_at = CURRENT_TIMESTAMP 
    WHERE status = 'processing'
  `).catch((e) => console.error('Failed to recover stuck broadcasts:', e));
  
  setInterval(async () => {
    if (isWorkerRunning) return;
    try {
      isWorkerRunning = true;
      await checkAndRunScheduledBroadcasts();
      await processJourneyEnrollments();
    } catch (err) {
      console.error('Worker run cycle error:', err);
    } finally {
      isWorkerRunning = false;
    }
  }, intervalMs);
}

/**
 * Checks for scheduled broadcasts ready for execution
 */
export async function checkAndRunScheduledBroadcasts() {
  const readyBroadcasts = await query(
    `SELECT b.*, 
            wg.credentials as whatsapp_credentials, wg.type as whatsapp_gateway_type, wg.id as whatsapp_gateway_id,
            eg.credentials as email_credentials, eg.type as email_gateway_type,
            wt.name as wt_name, wt.meta_template_name, wt.meta_language, wt.header_type as wt_header_type, wt.header_content as wt_header_content, wt.body_content as wt_body_content, wt.footer_content as wt_footer_content, wt.buttons_json as wt_buttons,
            et.name as et_name, et.email_subject, et.email_html, et.body_content as et_body_content
     FROM campaign_broadcasts b
     LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
     LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
     LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
     LEFT JOIN campaign_templates et ON b.email_template_id = et.id
     WHERE b.status = 'scheduled' AND b.scheduled_at <= CURRENT_TIMESTAMP
     ORDER BY b.scheduled_at ASC
     LIMIT 5`
  );

  for (const broadcast of readyBroadcasts.rows) {
    await processBroadcast(broadcast);
  }
}

/**
 * Processes a single broadcast in ultra-efficient keyset chunks with instant Play/Pause controls
 */
export async function processBroadcast(broadcast: any) {
  console.log(`🚀 Starting dispatch for broadcast: "${broadcast.name}" (ID: ${broadcast.id})`);

  // Register in active dispatchers
  activeDispatchers.set(broadcast.id, { pauseRequested: false });

  // Update status to processing
  await query(
    `UPDATE campaign_broadcasts 
     SET status = 'processing', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [broadcast.id]
  );

  emitBroadcastUpdate({
    broadcastId: broadcast.id,
    status: 'processing',
    message: `Broadcast "${broadcast.name}" is now processing...`,
  });

  try {
    const filters = broadcast.audience_filters && typeof broadcast.audience_filters === 'object'
      ? broadcast.audience_filters
      : (typeof broadcast.audience_filters === 'string' ? JSON.parse(broadcast.audience_filters || '{}') : {});

    const baseConditions: string[] = [];
    const baseParams: any[] = [];

    // Company isolation
    if (broadcast.company_name && broadcast.company_name !== 'OmniReach Global') {
      baseParams.push(broadcast.company_name);
      baseConditions.push(`company_name = $${baseParams.length}`);
    }

    // Direct upload vs Master Repo
    if (filters && filters.source === 'master_repo') {
      // Sr. No Range Filter
      if (filters.sr_no_start !== undefined && filters.sr_no_start !== null && filters.sr_no_start !== '') {
        baseParams.push(Number(filters.sr_no_start));
        baseConditions.push(`sr_no >= $${baseParams.length}`);
      }
      if (filters.sr_no_end !== undefined && filters.sr_no_end !== null && filters.sr_no_end !== '') {
        baseParams.push(Number(filters.sr_no_end));
        baseConditions.push(`sr_no <= $${baseParams.length}`);
      }

      // Channel requirement filter
      if (filters.channel_filter === 'phone_only') {
        baseConditions.push(`phone IS NOT NULL AND phone != ''`);
      } else if (filters.channel_filter === 'email_only') {
        baseConditions.push(`email IS NOT NULL AND email != ''`);
      } else if (filters.channel_filter === 'both') {
        baseConditions.push(`phone IS NOT NULL AND phone != '' AND email IS NOT NULL AND email != ''`);
      }

      // Opt-in filter
      if (filters.optin_filter === 'whatsapp_optin') {
        baseConditions.push(`whatsapp_optin = true`);
      } else if (filters.optin_filter === 'email_optin') {
        baseConditions.push(`email_optin = true`);
      }

      // Search keyword filter (phone variants, Sr. No, name, email, URN, FMCB)
      if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
        const searchCond = buildSearchClauses(filters.search, baseParams.length + 1);
        if (searchCond.clause) {
          baseConditions.push(searchCond.clause);
          baseParams.push(...searchCond.params);
        }
      }
    } else {
      // Linked direct upload
      baseParams.push(broadcast.id);
      baseConditions.push(`last_broadcast_id = $${baseParams.length}`);
    }

    const baseWhereSql = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    // Fast COUNT for total target audience (without loading all rows into Node memory)
    const countRes = await query(
      `SELECT COUNT(*) as total FROM campaign_master_leads ${baseWhereSql}`,
      baseParams
    );
    const totalTarget = parseInt(countRes.rows[0]?.total || '0', 10);

    // Sync total target count in database
    await query(
      `UPDATE campaign_broadcasts SET total_target_count = $1 WHERE id = $2`,
      [totalTarget, broadcast.id]
    );

    // Check if resuming from previous execution: find last processed Sr. No
    const maxLoggedRes = await query(
      `SELECT COALESCE(MAX(ml.sr_no), 0) as last_sr_no
       FROM campaign_logs cl
       JOIN campaign_master_leads ml ON cl.master_lead_id = ml.id
       WHERE cl.broadcast_id = $1`,
      [broadcast.id]
    );
    let lastSrNo = parseInt(maxLoggedRes.rows[0]?.last_sr_no || '0', 10);

    // Existing counters
    let whatsappSent = broadcast.whatsapp_sent || 0;
    let whatsappDelivered = broadcast.whatsapp_delivered || 0;
    let whatsappFailed = broadcast.whatsapp_failed || 0;
    let emailSent = broadcast.email_sent || 0;
    let emailDelivered = broadcast.email_delivered || 0;
    let emailFailed = broadcast.email_failed || 0;
    let totalSuppressed = broadcast.total_suppressed || 0;
    let processedTotal = whatsappSent + emailSent + totalSuppressed;

    const channel = broadcast.channel; // 'whatsapp', 'email', 'both'

    // Buffers to batch database writes
    let pendingLogs: any[] = [];
    let pendingWaSuccessLeadIds: string[] = [];
    let pendingEmailSuccessLeadIds: string[] = [];

    const flushLogsAndCounters = async () => {
      if (pendingLogs.length > 0) {
        const logsToFlush = [...pendingLogs];
        pendingLogs = [];

        const valueTuples: string[] = [];
        const params: any[] = [];
        for (let idx = 0; idx < logsToFlush.length; idx++) {
          const l = logsToFlush[idx];
          const offset = idx * 8;
          valueTuples.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
          params.push(l.broadcast_id, l.master_lead_id, l.channel, l.recipient, l.status, l.error_message || null, l.meta_message_id || null, l.ses_message_id || null);
        }
        await query(
          `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message, meta_message_id, ses_message_id)
           VALUES ${valueTuples.join(', ')}`,
          params
        );
      }

      if (pendingWaSuccessLeadIds.length > 0) {
        const ids = [...pendingWaSuccessLeadIds];
        pendingWaSuccessLeadIds = [];
        await query(
          `UPDATE campaign_master_leads 
           SET whatsapp_sent_count = whatsapp_sent_count + 1,
               whatsapp_delivered_count = whatsapp_delivered_count + 1,
               last_contacted_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1)`,
          [ids]
        );
      }

      if (pendingEmailSuccessLeadIds.length > 0) {
        const ids = [...pendingEmailSuccessLeadIds];
        pendingEmailSuccessLeadIds = [];
        await query(
          `UPDATE campaign_master_leads 
           SET email_sent_count = email_sent_count + 1,
               email_delivered_count = email_delivered_count + 1,
               last_contacted_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1)`,
          [ids]
        );
      }

      // Persist incremental counters to broadcast row
      await query(
        `UPDATE campaign_broadcasts 
         SET whatsapp_sent = $1, whatsapp_delivered = $2, whatsapp_failed = $3,
             email_sent = $4, email_delivered = $5, email_failed = $6,
             total_suppressed = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [whatsappSent, whatsappDelivered, whatsappFailed, emailSent, emailDelivered, emailFailed, totalSuppressed, broadcast.id]
      );
    };

    // Keyset Chunk Loop: Fetch 150 leads at a time using index on sr_no
    const CHUNK_SIZE = 150;
    let hasMore = true;

    while (hasMore) {
      // 1. Check if user requested PAUSE via API
      const dispState = activeDispatchers.get(broadcast.id);
      if (dispState?.pauseRequested) {
        console.log(`⏸️ Broadcast "${broadcast.name}" received Pause signal.`);
        await flushLogsAndCounters();
        await query(
          `UPDATE campaign_broadcasts SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [broadcast.id]
        );
        emitBroadcastUpdate({
          broadcastId: broadcast.id,
          status: 'paused',
          message: `Broadcast "${broadcast.name}" paused. Progress saved.`,
        });
        activeDispatchers.delete(broadcast.id);
        return;
      }

      // 2. Also check DB in case another process paused it
      const dbStatusCheck = await query(`SELECT status FROM campaign_broadcasts WHERE id = $1`, [broadcast.id]);
      if (dbStatusCheck.rows[0]?.status === 'paused') {
        console.log(`⏸️ Broadcast "${broadcast.name}" status is paused in DB.`);
        await flushLogsAndCounters();
        activeDispatchers.delete(broadcast.id);
        return;
      }

      // Keyset query: sr_no > lastSrNo
      const chunkConditions = [...baseConditions];
      const chunkParams = [...baseParams];

      chunkParams.push(lastSrNo);
      chunkConditions.push(`sr_no > $${chunkParams.length}`);

      chunkParams.push(CHUNK_SIZE);
      const limitParamIdx = chunkParams.length;

      const chunkWhereSql = chunkConditions.length > 0 ? `WHERE ${chunkConditions.join(' AND ')}` : '';
      const chunkRes = await query(
        `SELECT id, urn, fmcb_id, sr_no, full_name, phone, email, address, city, pan_no, custom_attributes, whatsapp_optin, email_optin
         FROM campaign_master_leads
         ${chunkWhereSql}
         ORDER BY sr_no ASC
         LIMIT $${limitParamIdx}`,
        chunkParams
      );

      const chunkLeads: LeadContext[] = chunkRes.rows;
      if (chunkLeads.length === 0) {
        hasMore = false;
        break;
      }

      for (let i = 0; i < chunkLeads.length; i++) {
        // Periodic check for pause inside chunk
        if (i % 20 === 0) {
          const checkDisp = activeDispatchers.get(broadcast.id);
          if (checkDisp?.pauseRequested) {
            hasMore = false;
            break;
          }
        }

        const lead: any = chunkLeads[i];
        lastSrNo = Number(lead.sr_no) || lastSrNo;
        processedTotal++;

        // A. WhatsApp Channel Dispatch
        if (channel === 'whatsapp' || channel === 'both') {
          if (!lead.phone) {
            if (channel === 'whatsapp') {
              totalSuppressed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'whatsapp',
                recipient: 'N/A',
                status: 'suppressed',
                error_message: 'Lead has no phone number recorded',
              });
            }
          } else if (!lead.whatsapp_optin) {
            totalSuppressed++;
            pendingLogs.push({
              broadcast_id: broadcast.id,
              master_lead_id: lead.id,
              channel: 'whatsapp',
              recipient: lead.phone,
              status: 'suppressed',
              error_message: 'Lead opted-out of WhatsApp communications',
            });
          } else {
            // Resolve Anti-Ban settings for Baileys
            const isBaileys = broadcast.whatsapp_gateway_type === 'whatsapp_baileys';
            const antiBanConfig: AntiBanSettings = {
              ...DEFAULT_ANTI_BAN_SETTINGS,
              ...(broadcast.whatsapp_credentials?.anti_ban_settings || {}),
            };

            // 1. Daily Safety Cap check for Baileys
            if (isBaileys && broadcast.whatsapp_gateway_id && antiBanConfig.daily_send_limit > 0) {
              const dailyCheck = await checkAndIncrementDailyCount(
                broadcast.whatsapp_gateway_id,
                antiBanConfig.daily_send_limit
              );
              if (!dailyCheck.allowed) {
                console.warn(`🛑 Anti-Ban: Daily safety limit (${antiBanConfig.daily_send_limit}) reached for Baileys gateway ${broadcast.whatsapp_gateway_id}.`);
                totalSuppressed++;
                pendingLogs.push({
                  broadcast_id: broadcast.id,
                  master_lead_id: lead.id,
                  channel: 'whatsapp',
                  recipient: lead.phone,
                  status: 'suppressed',
                  error_message: `Daily safety limit (${antiBanConfig.daily_send_limit} msgs/day) reached. Message suppressed.`,
                });
                continue;
              }
            }

            const res = await sendWhatsAppMessage(
              lead.phone,
              {
                meta_template_name: broadcast.meta_template_name,
                meta_language: broadcast.meta_language,
                header_type: broadcast.wt_header_type,
                header_content: broadcast.wt_header_content,
                body_content: broadcast.wt_body_content || 'Default notification',
                footer_content: broadcast.wt_footer_content,
                buttons_json: broadcast.wt_buttons,
              },
              lead,
              broadcast.whatsapp_credentials || {},
              broadcast.id,
              broadcast.whatsapp_gateway_type || 'whatsapp_meta',
              broadcast.whatsapp_gateway_id
            );

            // Anti-ban pacing delay and batch cooldowns for Baileys
            if (isBaileys && processedTotal < totalTarget) {
              const batchSize = antiBanConfig.batch_size || 20;
              const cooldownSec = antiBanConfig.batch_cooldown_seconds || 60;

              if (processedTotal % batchSize === 0) {
                console.log(`☕ Anti-Ban: Dispatched batch of ${batchSize} messages. Cooling down for ${cooldownSec}s...`);
                emitBroadcastUpdate({
                  broadcastId: broadcast.id,
                  status: 'cooling_down',
                  message: `Anti-Ban: Pausing for ${cooldownSec}s after ${processedTotal} messages...`,
                });
                await new Promise((resolve) => setTimeout(resolve, cooldownSec * 1000));
              } else {
                const delayMs = calculatePacingDelay(antiBanConfig);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
              }
            }

            if (res.status === 'suppressed') {
              totalSuppressed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'whatsapp',
                recipient: lead.phone,
                status: 'suppressed',
                error_message: res.error || 'Suppressed by anti-ban protection',
              });
            } else if (res.success) {
              whatsappSent++;
              whatsappDelivered++;
              pendingWaSuccessLeadIds.push(lead.id);
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'whatsapp',
                recipient: lead.phone,
                status: 'delivered',
                meta_message_id: res.messageId,
              });
            } else {
              whatsappFailed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'whatsapp',
                recipient: lead.phone,
                status: 'failed',
                error_message: res.error,
              });
            }
          }
        }

        // B. Email Channel Dispatch
        if (channel === 'email' || channel === 'both') {
          if (!lead.email) {
            if (channel === 'email') {
              totalSuppressed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'email',
                recipient: 'N/A',
                status: 'suppressed',
                error_message: 'Lead has no email address recorded',
              });
            }
          } else if (!lead.email_optin) {
            totalSuppressed++;
            pendingLogs.push({
              broadcast_id: broadcast.id,
              master_lead_id: lead.id,
              channel: 'email',
              recipient: lead.email,
              status: 'suppressed',
              error_message: 'Lead opted-out of Email communications',
            });
          } else {
            const res = await sendEmailMessage(
              lead.email,
              {
                email_subject: broadcast.email_subject || 'OmniReach Notification',
                email_html: broadcast.email_html,
                body_content: broadcast.et_body_content,
              },
              lead,
              broadcast.email_credentials || {},
              broadcast.email_gateway_type || 'email_smtp',
              broadcast.id
            );

            if (res.success) {
              emailSent++;
              emailDelivered++;
              pendingEmailSuccessLeadIds.push(lead.id);
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'email',
                recipient: lead.email,
                status: 'delivered',
                ses_message_id: res.messageId,
              });
            } else {
              emailFailed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'email',
                recipient: lead.email,
                status: 'failed',
                error_message: res.error,
              });
            }
          }
        }
      }

      // Flush logs and counters at end of each chunk
      await flushLogsAndCounters();

      emitBroadcastUpdate({
        broadcastId: broadcast.id,
        progress: totalTarget > 0 ? Math.min(100, Math.round((processedTotal / totalTarget) * 100)) : 100,
        processed: processedTotal,
        total: totalTarget,
        delivered: whatsappDelivered + emailDelivered,
        suppressed: totalSuppressed,
        failed: whatsappFailed + emailFailed,
      });

      if (chunkLeads.length < CHUNK_SIZE) {
        hasMore = false;
      }
    }

    // Check if stopped due to pause
    const finalDispCheck = activeDispatchers.get(broadcast.id);
    if (finalDispCheck?.pauseRequested) {
      await query(`UPDATE campaign_broadcasts SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [broadcast.id]);
      emitBroadcastUpdate({ broadcastId: broadcast.id, status: 'paused', message: `Broadcast "${broadcast.name}" paused.` });
      activeDispatchers.delete(broadcast.id);
      return;
    }

    await flushLogsAndCounters();

    // Set 1-hour cooldown timestamp
    const cooldownTime = new Date(Date.now() + 60 * 60 * 1000);
    const totalDelivered = whatsappDelivered + emailDelivered;
    const totalFailed = whatsappFailed + emailFailed;
    const finalStatus =
      totalDelivered > 0
        ? totalFailed > 0
          ? 'completed_with_errors'
          : 'completed'
        : totalFailed > 0
        ? 'failed'
        : 'completed';

    // Finalize Broadcast Status
    await query(
      `UPDATE campaign_broadcasts 
       SET status = $1,
           completed_at = CURRENT_TIMESTAMP,
           cooldown_until = $2,
           total_target_count = $3,
           whatsapp_sent = $4,
           whatsapp_delivered = $5,
           whatsapp_failed = $6,
           email_sent = $7,
           email_delivered = $8,
           email_failed = $9,
           total_suppressed = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [
        finalStatus,
        cooldownTime,
        totalTarget,
        whatsappSent,
        whatsappDelivered,
        whatsappFailed,
        emailSent,
        emailDelivered,
        emailFailed,
        totalSuppressed,
        broadcast.id,
      ]
    );

    activeDispatchers.delete(broadcast.id);

    emitBroadcastUpdate({
      broadcastId: broadcast.id,
      status: finalStatus,
      stats: {
        total_target_count: totalTarget,
        whatsapp_sent: whatsappSent,
        whatsapp_delivered: whatsappDelivered,
        whatsapp_failed: whatsappFailed,
        email_sent: emailSent,
        email_delivered: emailDelivered,
        email_failed: emailFailed,
        total_suppressed: totalSuppressed,
      },
      message:
        finalStatus === 'failed'
          ? `Broadcast "${broadcast.name}" failed to deliver. Check gateway credentials.`
          : `Broadcast "${broadcast.name}" completed!`,
    });
  } catch (err: any) {
    console.error(`❌ Broadcast "${broadcast.name}" failed:`, err);
    activeDispatchers.delete(broadcast.id);
    await query(
      `UPDATE campaign_broadcasts SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [broadcast.id]
    );
    emitBroadcastUpdate({
      broadcastId: broadcast.id,
      status: 'failed',
      error: err.message,
    });
  }
}
