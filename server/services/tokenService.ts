export interface LeadContext {
  id: string;
  urn?: string | null;
  fmcb_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  pan_no?: string | null;
  custom_attributes?: Record<string, any>;
}

export function resolveTokens(
  content: string,
  lead: LeadContext,
  broadcastId?: string
): string {
  if (!content) return '';

  const baseUrl = process.env.BASE_APP_URL || 'http://localhost:5173';
  const displayId = lead.urn || lead.fmcb_id;
  const unsubscribeUrl = `${baseUrl}/unsubscribe?lead=${lead.id}&broadcast=${broadcastId || ''}`;
  const contactCenterUrl = `${baseUrl}/contact-center?lead=${lead.id}&utm_broadcast_id=${broadcastId || ''}`;

  let result = content;

  result = result.replace(/{name}/gi, lead.full_name || 'Customer');
  result = result.replace(/{contact}/gi, lead.phone || '');
  result = result.replace(/{mail}/gi, lead.email || '');
  result = result.replace(/{address}/gi, lead.address || lead.city || '');
  result = result.replace(/{id}/gi, displayId);
  result = result.replace(/{urn}/gi, lead.urn || lead.fmcb_id);
  result = result.replace(/{fmcb_id}/gi, lead.fmcb_id);
  result = result.replace(/{city}/gi, lead.city || '');
  result = result.replace(/{unsubscribe_url}/gi, unsubscribeUrl);
  result = result.replace(/{contact_center_url}/gi, contactCenterUrl);

  // Meta positional tokens {{1}}, {{2}}...
  result = result.replace(/{{1}}/g, lead.full_name || 'Customer');
  result = result.replace(/{{2}}/g, displayId);
  result = result.replace(/{{3}}/g, lead.phone || '');
  result = result.replace(/{{4}}/g, lead.email || '');

  return result;
}

export function wrapUrlsForClickTracking(
  html: string,
  broadcastId: string,
  leadId: string
): string {
  const publicApiUrl = process.env.PUBLIC_API_URL || 'http://localhost:5000';

  // Replace href attributes except unsubscribe and contact-center links
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
    if (url.includes('/unsubscribe') || url.includes('/contact-center') || url.includes('/api/c/t/')) {
      return match;
    }
    const trackingUrl = `${publicApiUrl}/api/c/t/${broadcastId}/${leadId}?url=${encodeURIComponent(url)}`;
    return `href="${trackingUrl}"`;
  });
}
