import { Request, Response, NextFunction } from 'express';

export interface LogMember {
  id?: string;
  email?: string;
  full_name?: string;
  role?: string;
  company_name?: string;
}

export function formatMemberInfo(member?: LogMember | null, fallbackEmail?: string): string {
  if (member && (member.email || member.full_name)) {
    const name = member.full_name || 'Member';
    const email = member.email || 'no-email';
    const role = member.role || 'user';
    const company = member.company_name || 'Independent';
    return `${name} (${email}) [Role: ${role}, Co: "${company}"]`;
  }
  if (fallbackEmail) {
    return `Candidate (${fallbackEmail}) [Unauthenticated]`;
  }
  return 'Guest / System / Unauthenticated';
}

function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Express Middleware: logs every HTTP request with member attribution & response time
 */
export function requestLoggerMiddleware(req: Request & { user?: LogMember }, res: Response, next: NextFunction) {
  const start = Date.now();

  const isApi = req.originalUrl.startsWith('/api');
  const isHealth = req.originalUrl === '/api/health';

  if (!isApi || isHealth) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const member = req.user;
    const fallbackEmail = req.body?.email || (req.query?.email as string) || undefined;
    const memberStr = formatMemberInfo(member, fallbackEmail);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';

    const statusBadge =
      statusCode >= 500
        ? `❌ ${statusCode}`
        : statusCode >= 400
        ? `⚠️ ${statusCode}`
        : `✅ ${statusCode}`;

    console.log(
      `[OmniReach-API] 🕒 ${getTimestamp()} | ${statusBadge} ${req.method} ${req.originalUrl} (${duration}ms) | MEMBER: ${memberStr} | IP: ${ip}`
    );
  });

  next();
}

/**
 * Structured logger for Gateway operations (Connect, Disconnect, QR Scan, Pairing)
 */
export function logGatewayEvent(params: {
  action: string;
  gatewayName: string;
  gatewayId?: string;
  companyName?: string;
  user?: LogMember | null;
  phone?: string | null;
  details?: any;
}) {
  const memberStr = formatMemberInfo(params.user);
  const co = params.companyName ? ` [Company: "${params.companyName}"]` : '';
  const phone = params.phone ? ` (+${params.phone})` : '';
  console.log(
    `[OmniReach-Gateway] 🕒 ${getTimestamp()} | ACTION: ${params.action} | GATEWAY: "${params.gatewayName}"${phone}${co} | MEMBER: ${memberStr}${
      params.details ? ` | DETAILS: ${JSON.stringify(params.details)}` : ''
    }`
  );
}

/**
 * Structured logger for Messaging events (Outbound, Inbound, Status Tick Changes)
 */
export function logMessagingEvent(params: {
  action: 'OUTBOUND_SENT' | 'INBOUND_RECEIVED' | 'STATUS_CHANGE' | 'DELETE';
  phone: string;
  companyName?: string;
  gatewayName?: string;
  status?: string;
  messageId?: string;
  user?: LogMember | null;
  textSnippet?: string;
}) {
  const memberStr = formatMemberInfo(params.user);
  const co = params.companyName ? ` [Company: "${params.companyName}"]` : '';
  const gw = params.gatewayName ? ` [Via: "${params.gatewayName}"]` : '';
  const status = params.status ? ` [Status: ${params.status.toUpperCase()}]` : '';
  const snippet = params.textSnippet ? ` | MSG: "${params.textSnippet.slice(0, 50)}"` : '';

  console.log(
    `[OmniReach-Message] 🕒 ${getTimestamp()} | ${params.action}${status} | TO/FROM: ${params.phone}${co}${gw}${snippet} | MEMBER: ${memberStr}`
  );
}

/**
 * Structured logger for Broadcast Campaign dispatches
 */
export function logBroadcastEvent(params: {
  action: 'DISPATCH_START' | 'DISPATCH_PROGRESS' | 'DISPATCH_COMPLETE' | 'DISPATCH_FAILED';
  campaignId: string;
  campaignName: string;
  companyName?: string;
  user?: LogMember | null;
  totalLeads?: number;
  sentCount?: number;
  failedCount?: number;
}) {
  const memberStr = formatMemberInfo(params.user);
  const co = params.companyName ? ` [Company: "${params.companyName}"]` : '';
  const counts = params.totalLeads !== undefined ? ` [Progress: ${params.sentCount || 0}/${params.totalLeads}, Failed: ${params.failedCount || 0}]` : '';

  console.log(
    `[OmniReach-Broadcast] 🕒 ${getTimestamp()} | ${params.action} | CAMPAIGN: "${params.campaignName}" (${params.campaignId})${co}${counts} | MEMBER: ${memberStr}`
  );
}

/**
 * Structured logger for Security & Data Center operations (Wipe, Batch Delete, Role Changes)
 */
export function logSecurityEvent(params: {
  action: string;
  user?: LogMember | null;
  targetCompany?: string;
  countAffected?: number;
  details?: any;
}) {
  const memberStr = formatMemberInfo(params.user);
  const target = params.targetCompany ? ` [Target Company: "${params.targetCompany}"]` : '';
  const count = params.countAffected !== undefined ? ` [Rows Affected: ${params.countAffected}]` : '';

  console.log(
    `[OmniReach-Security] 🕒 ${getTimestamp()} | 🚨 ACTION: ${params.action}${target}${count} | INITIATED BY: ${memberStr}${
      params.details ? ` | DETAILS: ${JSON.stringify(params.details)}` : ''
    }`
  );
}
