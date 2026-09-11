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

let ioInstance: SocketIOServer | null = null;
let isWorkerRunning = false;

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
 * Processes a single broadcast batch
 */
export async function processBroadcast(broadcast: any) {
  console.log(`🚀 Starting dispatch for broadcast: "${broadcast.name}" (ID: ${broadcast.id})`);

  // Update status to processing
  await query(
    `UPDATE campaign_broadcasts 
     SET status = 'processing', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [broadcast.id]
  );

  emitBroadcastUpdate({
    broadcastId: broadcast.id,
    status: 'processing',
    message: `Broadcast "${broadcast.name}" is now processing...`,
  });

  try {
    // 1. Fetch Target Contacts for this broadcast
    let leadsRes = await query(
      `SELECT id, urn, fmcb_id, full_name, phone, email, address, city, pan_no, custom_attributes, whatsapp_optin, email_optin
       FROM campaign_master_leads
       WHERE last_broadcast_id = $1
       ORDER BY created_at ASC`,
      [broadcast.id]
    );

    // If no specific leads linked to this broadcast id, target all master leads in company
    if (leadsRes.rows.length === 0) {
      const compCondition = broadcast.company_name && broadcast.company_name !== 'OmniReach Global'
        ? `WHERE (company_name = $1 OR company_name = 'OmniReach Global')`
        : '';
      const params = compCondition ? [broadcast.company_name] : [];
      leadsRes = await query(
        `SELECT id, urn, fmcb_id, full_name, phone, email, address, city, pan_no, custom_attributes, whatsapp_optin, email_optin
         FROM campaign_master_leads
         ${compCondition}
         ORDER BY created_at ASC`,
        params
      );
    }

    const leads: LeadContext[] = leadsRes.rows;
    let whatsappSent = 0;
    let whatsappDelivered = 0;
    let whatsappFailed = 0;
    let emailSent = 0;
    let emailDelivered = 0;
    let emailFailed = 0;
    let totalSuppressed = 0;

    const channel = broadcast.channel; // 'whatsapp', 'email', 'both'

    // Buffers to batch database writes (eliminates 100,000+ single roundtrips)
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
    };

    for (let i = 0; i < leads.length; i++) {
      const lead: any = leads[i];

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
              console.warn(`🛑 Anti-Ban: Daily safety limit (${antiBanConfig.daily_send_limit}) reached for Baileys gateway ${broadcast.whatsapp_gateway_id}. Halting message dispatch.`);
              totalSuppressed++;
              pendingLogs.push({
                broadcast_id: broadcast.id,
                master_lead_id: lead.id,
                channel: 'whatsapp',
                recipient: lead.phone,
                status: 'suppressed',
                error_message: `Daily safety limit (${antiBanConfig.daily_send_limit} msgs/day) reached. Message suppressed to protect number.`,
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

          // 2. Anti-ban pacing delay and batch cooldowns for Baileys
          if (isBaileys && i < leads.length - 1) {
            const batchSize = antiBanConfig.batch_size || 20;
            const cooldownSec = antiBanConfig.batch_cooldown_seconds || 60;

            if ((i + 1) % batchSize === 0) {
              console.log(`☕ Anti-Ban: Dispatched batch of ${batchSize} messages. Cooling down for ${cooldownSec}s...`);
              emitBroadcastUpdate({
                broadcastId: broadcast.id,
                status: 'cooling_down',
                message: `Anti-Ban Protection: Pausing for ${cooldownSec}s after ${i + 1} messages to safeguard number...`,
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

      // Periodic flush and progress emission
      if ((i + 1) % 50 === 0 || i === leads.length - 1) {
        await flushLogsAndCounters();
        emitBroadcastUpdate({
          broadcastId: broadcast.id,
          progress: Math.round(((i + 1) / leads.length) * 100),
          processed: i + 1,
          total: leads.length,
          delivered: whatsappDelivered + emailDelivered,
          suppressed: totalSuppressed,
          failed: whatsappFailed + emailFailed,
        });
      }
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
        leads.length,
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

    if (finalStatus === 'failed') {
      console.error(`❌ Broadcast "${broadcast.name}" failed: All ${totalFailed} recipient dispatches failed. Check gateway credentials.`);
    } else if (finalStatus === 'completed_with_errors') {
      console.warn(`⚠️ Broadcast "${broadcast.name}" completed with warnings: ${totalDelivered} delivered, ${totalFailed} failed.`);
    } else {
      console.log(`✅ Broadcast "${broadcast.name}" completed successfully (${totalDelivered} delivered).`);
    }

    emitBroadcastUpdate({
      broadcastId: broadcast.id,
      status: finalStatus,
      stats: {
        total_target_count: leads.length,
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
