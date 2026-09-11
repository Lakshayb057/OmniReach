import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { query } from '../config/db';
import { saveInboundMessage } from './inboxService';
import { normalizePhone } from './leadsMatcher';
import {
  parseSpintax,
  applyPolymorphicVariation,
  validateNumberOnWhatsApp,
  simulateHumanPresence,
  isOptOutMessage,
  isOptInMessage,
  OPT_OUT_CONFIRMATION_TEXT,
  OPT_IN_CONFIRMATION_TEXT,
  DEFAULT_ANTI_BAN_SETTINGS,
  AntiBanSettings,
} from './antiBanService';

export interface BaileysSession {
  gatewayId: string;
  companyName: string;
  socket: WASocket | null;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  reconnectAttempts: number;
  isExplicitlyClosed?: boolean;
  reconnectTimer?: NodeJS.Timeout;
}

// In-memory registry of active Baileys socket sessions (keyed by gatewayId)
const activeSessions: Map<string, BaileysSession> = new Map();

let ioInstance: SocketIOServer | null = null;

export function setSocketIOInstanceForBaileys(io: SocketIOServer) {
  ioInstance = io;
}

function emitBaileysEvent(eventType: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(eventType, data);
  }
}

const AUTH_BASE_DIR = path.join(__dirname, '../baileys_auth_info');

function getAuthFolder(gatewayId: string): string {
  const folder = path.join(AUTH_BASE_DIR, gatewayId.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  return folder;
}

/**
 * Returns session snapshot or undefined
 */
export function getBaileysSession(gatewayId: string): BaileysSession | undefined {
  return activeSessions.get(gatewayId);
}

/**
 * Returns all active session summaries
 */
export function getAllBaileysSessions(): Array<{
  gatewayId: string;
  companyName: string;
  status: string;
  phoneNumber: string | null;
  pushName: string | null;
  connectedAt: Date | null;
  hasQr: boolean;
}> {
  const list: any[] = [];
  activeSessions.forEach((session, gatewayId) => {
    list.push({
      gatewayId,
      companyName: session.companyName,
      status: session.status,
      phoneNumber: session.phoneNumber,
      pushName: session.pushName,
      connectedAt: session.connectedAt,
      hasQr: !!session.qrCodeDataUrl,
    });
  });
  return list;
}

/**
 * Initialize / start a Baileys session for a given gateway
 */
export async function initBaileysSession(
  gatewayId: string,
  companyName: string = 'OmniReach Global',
  options: { phoneNumberForPairing?: string } = {}
): Promise<BaileysSession> {
  const existing = activeSessions.get(gatewayId);
  if (existing && (existing.status === 'connected' || existing.status === 'connecting') && existing.socket) {
    return existing;
  }

  const sessionDir = getAuthFolder(gatewayId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const session: BaileysSession = {
    gatewayId,
    companyName,
    socket: null,
    status: 'connecting',
    qrCodeDataUrl: null,
    qrRaw: null,
    pairingCode: null,
    phoneNumber: existing?.phoneNumber || null,
    pushName: existing?.pushName || null,
    connectedAt: null,
    lastError: null,
    reconnectAttempts: 0,
  };

  activeSessions.set(gatewayId, session);

  emitBaileysEvent('BAILEYS_STATUS', {
    gatewayId,
    status: 'connecting',
    message: 'Starting WhatsApp Web multi-device socket...',
  });

  try {
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'),
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: true,
    });

    session.socket = sock;

    // Listen for auth credentials update
    sock.ev.on('creds.update', saveCreds);

    // If pairing code was requested and not yet registered
    if (options.phoneNumberForPairing && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const cleanPhone = options.phoneNumberForPairing!.replace(/[^0-9]/g, '');
          const pairingCode = await sock.requestPairingCode(cleanPhone);
          session.pairingCode = pairingCode;
          emitBaileysEvent('BAILEYS_PAIRING_CODE', {
            gatewayId,
            pairingCode,
            phoneNumber: cleanPhone,
          });
          console.log(`🔑 Baileys Pairing Code for ${cleanPhone}: ${pairingCode}`);
        } catch (pairErr: any) {
          console.error(`❌ Failed to request Baileys pairing code for gateway ${gatewayId}:`, pairErr.message);
        }
      }, 3000);
    }

    // Connection lifecycle
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qrRaw = qr;
        session.status = 'qr_ready';
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          session.qrCodeDataUrl = qrDataUrl;
          emitBaileysEvent('BAILEYS_QR', {
            gatewayId,
            qrCodeDataUrl: qrDataUrl,
            qrRaw: qr,
          });
          emitBaileysEvent('BAILEYS_STATUS', {
            gatewayId,
            status: 'qr_ready',
            message: 'QR code generated. Scan with WhatsApp.',
          });
        } catch (qrErr: any) {
          console.error('Failed to generate QR code data URL:', qrErr);
        }
      }

      if (connection === 'open') {
        session.status = 'connected';
        session.qrCodeDataUrl = null;
        session.qrRaw = null;
        session.pairingCode = null;
        session.connectedAt = new Date();
        session.reconnectAttempts = 0;

        const userJid = sock.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        const pushName = sock.user?.name || 'WhatsApp Account';

        session.phoneNumber = phone;
        session.pushName = pushName;

        console.log(`✅ Baileys WhatsApp Gateway "${gatewayId}" connected! Phone: +${phone} (${pushName})`);

        // Update database gateway status
        try {
          const statusDetails = {
            status: 'CONNECTED',
            phone,
            push_name: pushName,
            connected_at: session.connectedAt,
            protocol: 'Baileys Multi-Device Web Socket',
          };

          await query(
            `UPDATE gateways_config 
             SET quality_rating = 'GREEN',
                 status_details = $1,
                 credentials = jsonb_set(
                   jsonb_set(COALESCE(credentials, '{}'::jsonb), '{display_phone_number}', to_jsonb($2::text)),
                   '{push_name}', to_jsonb($3::text)
                 ),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [JSON.stringify(statusDetails), phone, pushName, gatewayId]
          );
        } catch (dbErr: any) {
          console.error('Failed to update gateway status in DB on open:', dbErr.message);
        }

        emitBaileysEvent('BAILEYS_STATUS', {
          gatewayId,
          status: 'connected',
          phoneNumber: phone,
          pushName,
          connectedAt: session.connectedAt,
          message: `Connected successfully to +${phone}`,
        });
      }

      if (connection === 'close') {
        if (session.isExplicitlyClosed) {
          session.status = 'disconnected';
          session.socket = null;
          session.qrCodeDataUrl = null;
          return;
        }

        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown error';
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.warn(`⚠️ Baileys Gateway "${gatewayId}" connection closed. Status: ${statusCode}. Reason: ${reason}`);

        session.status = 'disconnected';
        session.socket = null;
        session.qrCodeDataUrl = null;

        // If logged out from phone, purge auth folder
        if (isLoggedOut) {
          console.log(`🧹 Baileys Gateway "${gatewayId}" was logged out. Purging session auth credentials.`);
          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
          } catch (cleanErr: any) {
            console.error('Error cleaning session dir:', cleanErr.message);
          }

          session.phoneNumber = null;
          session.pushName = null;

          try {
            await query(
              `UPDATE gateways_config 
               SET quality_rating = 'RED',
                   status_details = '{"status": "DISCONNECTED", "reason": "LOGGED_OUT"}'::jsonb,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [gatewayId]
            );
          } catch (dbErr) {
            console.error('DB update failed on logout:', dbErr);
          }

          emitBaileysEvent('BAILEYS_STATUS', {
            gatewayId,
            status: 'disconnected',
            reason: 'logged_out',
            message: 'Session was unlinked/logged out from WhatsApp.',
          });
        } else {
          // Auto-reconnect if temporary disconnect (network drop, server restart)
          session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
          const retryDelay = Math.min(30000, 3000 * Math.pow(1.5, session.reconnectAttempts - 1));

          console.log(`🔄 Attempting to reconnect Baileys gateway "${gatewayId}" in ${Math.round(retryDelay / 1000)}s...`);

          emitBaileysEvent('BAILEYS_STATUS', {
            gatewayId,
            status: 'disconnected',
            reason: 'temporary_disconnect',
            message: `Connection dropped. Reconnecting in ${Math.round(retryDelay / 1000)}s...`,
          });

          session.reconnectTimer = setTimeout(() => {
            const current = activeSessions.get(gatewayId);
            if (current && current.status !== 'connected' && !current.isExplicitlyClosed) {
              initBaileysSession(gatewayId, companyName).catch((err) => {
                console.error(`Reconnect error for gateway ${gatewayId}:`, err.message);
              });
            }
          }, retryDelay);
        }
      }
    });

    // Handle inbound WhatsApp messages
    sock.ev.on('messages.upsert', async (upsert) => {
      if (upsert.type !== 'notify' && upsert.type !== 'append') return;

      for (const msg of upsert.messages) {
        // Skip outbound messages sent from this device
        if (msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.includes('@g.us')) {
          // Ignore status broadcasts and group messages for individual CRM inbox
          continue;
        }

        const rawPhone = remoteJid.split('@')[0];
        const cleanPhone = normalizePhone(rawPhone) || rawPhone;
        const pushName = msg.pushName || 'WhatsApp Customer';

        // Extract message text from all possible WhatsApp message types
        const messageContent = msg.message;
        if (!messageContent) continue;

        let extractedText = '';
        let mediaUrl: string | undefined = undefined;
        let messageType = 'text';

        if (messageContent.conversation) {
          extractedText = messageContent.conversation;
        } else if (messageContent.extendedTextMessage?.text) {
          extractedText = messageContent.extendedTextMessage.text;
        } else if (messageContent.imageMessage) {
          extractedText = messageContent.imageMessage.caption || '[Image received]';
          messageType = 'image';
        } else if (messageContent.videoMessage) {
          extractedText = messageContent.videoMessage.caption || '[Video received]';
          messageType = 'video';
        } else if (messageContent.documentMessage) {
          extractedText = messageContent.documentMessage.fileName ? `[Document: ${messageContent.documentMessage.fileName}]` : '[Document received]';
          messageType = 'document';
        } else if (messageContent.buttonsResponseMessage) {
          extractedText = messageContent.buttonsResponseMessage.selectedDisplayText || messageContent.buttonsResponseMessage.selectedButtonId || '';
          messageType = 'interactive_button';
        } else if (messageContent.templateButtonReplyMessage) {
          extractedText = messageContent.templateButtonReplyMessage.selectedDisplayText || messageContent.templateButtonReplyMessage.selectedId || '';
          messageType = 'interactive_button';
        } else if (messageContent.listResponseMessage) {
          extractedText = messageContent.listResponseMessage.title || messageContent.listResponseMessage.singleSelectReply?.selectedRowId || '';
          messageType = 'interactive_list';
        }

        if (!extractedText.trim()) continue;

        console.log(`📩 Inbound Baileys message received from ${pushName} (${cleanPhone}): "${extractedText.slice(0, 40)}"`);

        try {
          // Anti-ban Auto-Read simulation: acknowledge inbound message to reflect active human session
          await sock.readMessages([msg.key]).catch(() => {});

          // Feed message into the unified Live Chat Inbox & Journey Automation Engine
          await saveInboundMessage({
            phone: cleanPhone,
            text: extractedText,
            contact_name: pushName,
            company_name: companyName,
            whatsapp_message_id: msg.key.id || undefined,
            message_type: messageType,
            media_url: mediaUrl,
          });

          // Anti-ban Opt-Out / Opt-In keyword detection
          if (isOptOutMessage(extractedText)) {
            console.log(`🛑 Anti-Ban: Opt-out STOP received from ${cleanPhone}. Suppressing contact.`);
            await query(
              `UPDATE campaign_master_leads 
               SET whatsapp_optin = false, updated_at = CURRENT_TIMESTAMP 
               WHERE phone = $1 OR phone LIKE $2`,
              [cleanPhone, `%${cleanPhone.slice(-10)}`]
            );
            await sock.sendMessage(remoteJid, { text: OPT_OUT_CONFIRMATION_TEXT });
          } else if (isOptInMessage(extractedText)) {
            console.log(`✅ Anti-Ban: Opt-in START received from ${cleanPhone}. Re-enabling contact.`);
            await query(
              `UPDATE campaign_master_leads 
               SET whatsapp_optin = true, updated_at = CURRENT_TIMESTAMP 
               WHERE phone = $1 OR phone LIKE $2`,
              [cleanPhone, `%${cleanPhone.slice(-10)}`]
            );
            await sock.sendMessage(remoteJid, { text: OPT_IN_CONFIRMATION_TEXT });
          }
        } catch (inboundErr: any) {
          console.error(`❌ Error ingesting inbound Baileys message from ${cleanPhone}:`, inboundErr.message);
        }
      }
    });

    return session;
  } catch (err: any) {
    session.status = 'disconnected';
    session.lastError = err.message;
    console.error(`❌ Failed to initialize Baileys session for gateway "${gatewayId}":`, err);
    throw err;
  }
}

/**
 * Request an 8-character Pairing Code for linking without scanning QR
 */
export async function requestBaileysPairingCode(
  gatewayId: string,
  phoneNumber: string,
  companyName: string = 'OmniReach Global'
): Promise<string> {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Please provide a valid international phone number with country code (e.g. 919876543210)');
  }

  let session = activeSessions.get(gatewayId);
  if (!session || !session.socket) {
    session = await initBaileysSession(gatewayId, companyName, { phoneNumberForPairing: cleanPhone });
  }

  if (session.status === 'connected') {
    throw new Error('This Baileys gateway is already connected.');
  }

  // Wait a short moment if socket is spinning up
  if (!session.socket) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!session.socket) {
    throw new Error('Baileys socket could not be created.');
  }

  const code = await session.socket.requestPairingCode(cleanPhone);
  session.pairingCode = code;

  emitBaileysEvent('BAILEYS_PAIRING_CODE', {
    gatewayId,
    pairingCode: code,
    phoneNumber: cleanPhone,
  });

  return code;
}

/**
 * Send an outbound WhatsApp message via Baileys Web Socket
 */
export async function sendBaileysMessage(
  gatewayId: string,
  recipientPhone: string,
  messageData: {
    text?: string;
    body_content?: string;
    header_content?: string;
    footer_content?: string;
    media_url?: string;
  },
  antiBanOverrides?: Partial<AntiBanSettings>
): Promise<{ success: boolean; messageId?: string; error?: string; status: 'delivered' | 'failed' | 'suppressed' }> {
  const cleanPhone = normalizePhone(recipientPhone).replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    return { success: false, error: 'Invalid recipient phone number', status: 'failed' };
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;

  let session = activeSessions.get(gatewayId);

  // If no session or socket not connected, try to find company and reconnect
  if (!session || !session.socket || session.status !== 'connected') {
    try {
      const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [gatewayId]);
      if (gwRes.rows.length > 0) {
        const gw = gwRes.rows[0];
        session = await initBaileysSession(gw.id, gw.company_name);
        // Give 2 seconds to check if already authenticated
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (e) {
      // Continue
    }
  }

  if (!session || !session.socket || session.status !== 'connected') {
    return {
      success: false,
      error: `Baileys Gateway "${gatewayId}" is not connected to WhatsApp. Please scan the QR code in Gateway Settings.`,
      status: 'failed',
    };
  }

  // Resolve Anti-Ban configuration for this gateway
  let antiBanConfig: AntiBanSettings = { ...DEFAULT_ANTI_BAN_SETTINGS, ...antiBanOverrides };
  try {
    const gwRes = await query('SELECT credentials FROM gateways_config WHERE id = $1', [gatewayId]);
    if (gwRes.rows.length > 0 && gwRes.rows[0].credentials?.anti_ban_settings) {
      antiBanConfig = {
        ...DEFAULT_ANTI_BAN_SETTINGS,
        ...gwRes.rows[0].credentials.anti_ban_settings,
        ...antiBanOverrides,
      };
    }
  } catch (err: any) {
    console.warn('Failed to load gateway anti-ban settings:', err.message);
  }

  // 1. PRE-FLIGHT CHECK: Verify number exists on WhatsApp before dispatch
  if (antiBanConfig.preflight_number_check) {
    const checkResult = await validateNumberOnWhatsApp(session.socket, cleanPhone);
    if (!checkResult.exists) {
      console.warn(`🛑 Pre-flight Anti-Ban: Number +${cleanPhone} is NOT registered on WhatsApp. Aborting to protect number.`);
      return {
        success: false,
        error: `Number +${cleanPhone} is not registered on WhatsApp. Suppressed to protect sender reputation.`,
        status: 'suppressed',
      };
    }
  }

  try {
    let fullText = messageData.body_content || messageData.text || '';
    if (messageData.header_content) {
      fullText = `*${messageData.header_content}*\n\n${fullText}`;
    }
    if (messageData.footer_content) {
      fullText = `${fullText}\n\n_${messageData.footer_content}_`;
    }

    // 2. SPINTAX EXPANSION: Resolve {Hi|Hello|Hey} expressions
    fullText = parseSpintax(fullText);

    // 3. OPT-OUT FOOTER: Optional automated unsubscribe footer to prevent spam reports
    if (antiBanConfig.append_opt_out_footer && !fullText.toLowerCase().includes('stop')) {
      fullText = `${fullText}\n\n_Reply STOP to unsubscribe_`;
    }

    // 4. POLYMORPHIC ANTI-HASH: Inject randomized zero-width non-breaking characters
    // Visually identical to user, but 100% unique cryptographic SHA-256 hash for WhatsApp servers
    if (antiBanConfig.polymorphic_anti_hash) {
      fullText = applyPolymorphicVariation(fullText);
    }

    // 5. HUMAN PRESENCE & TYPING SIMULATION: (available -> composing -> delay -> paused)
    if (antiBanConfig.simulate_human_typing) {
      await simulateHumanPresence(session.socket, jid, fullText.length);
    }

    const result = await session.socket.sendMessage(jid, {
      text: fullText,
    });

    const messageId = result?.key?.id || `baileys_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      messageId,
      status: 'delivered',
    };
  } catch (err: any) {
    console.error(`❌ Baileys dispatch error to ${recipientPhone}:`, err.message);
    return {
      success: false,
      error: err.message || 'Failed to dispatch via Baileys socket.',
      status: 'failed',
    };
  }
}

/**
 * Disconnect and optionally log out a Baileys session
 */
export async function disconnectBaileysSession(gatewayId: string, purgeAuth: boolean = false): Promise<boolean> {
  const session = activeSessions.get(gatewayId);
  if (session) {
    session.isExplicitlyClosed = true;
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = undefined;
    }
    if (session.socket) {
      try {
        session.socket.end(new Error('User requested disconnect'));
      } catch (e) {
        // Ignore
      }
      session.socket = null;
    }
  }

  if (purgeAuth) {
    const sessionDir = getAuthFolder(gatewayId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (err: any) {
      console.error('Failed to purge auth folder:', err);
    }
  }

  activeSessions.delete(gatewayId);

  await query(
    `UPDATE gateways_config 
     SET quality_rating = 'RED',
         status_details = '{"status": "DISCONNECTED"}'::jsonb,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [gatewayId]
  );

  emitBaileysEvent('BAILEYS_STATUS', {
    gatewayId,
    status: 'disconnected',
    message: 'Gateway session closed.',
  });

  return true;
}

/**
 * Restores all previously active Baileys sessions on server boot
 */
export async function restoreAllBaileysSessions(): Promise<void> {
  try {
    const res = await query(
      `SELECT * FROM gateways_config 
       WHERE type = 'whatsapp_baileys' AND is_active = true`
    );

    if (res.rows.length === 0) {
      console.log('ℹ️ No active WhatsApp Baileys gateways found to restore.');
      return;
    }

    console.log(`📡 Restoring ${res.rows.length} WhatsApp Baileys gateway session(s)...`);

    for (const gw of res.rows) {
      try {
        const sessionDir = getAuthFolder(gw.id);
        const hasAuthKeys = fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
        
        // Only auto-connect if auth keys exist or status was previously connected
        if (hasAuthKeys) {
          console.log(`🔌 Restoring Baileys session for gateway: "${gw.name}" (${gw.company_name})...`);
          await initBaileysSession(gw.id, gw.company_name);
        } else {
          console.log(`⏳ Baileys gateway "${gw.name}" waiting for QR scan in Gateway Settings.`);
        }
      } catch (gwErr: any) {
        console.error(`Failed to restore Baileys session for "${gw.name}":`, gwErr.message);
      }
    }
  } catch (err: any) {
    console.error('Error in restoreAllBaileysSessions:', err.message);
  }
}
