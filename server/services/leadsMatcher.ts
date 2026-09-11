import { query, pool } from '../config/db';

export interface RawContactInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  pan_no?: string;
  city?: string;
  custom_attributes?: Record<string, any>;
}

export interface IngestionResult {
  totalProcessed: number;
  newInserted: number;
  updatedExisting: number;
  matchedUrnCount: number;
  newFmcbCount: number;
  invalidCount: number;
  errors: { row: number; reason: string; data: any }[];
  leadIds: string[];
}

/**
 * Normalizes phone numbers into standard 12-digit or 10-digit Indian format (e.g. 919876543210)
 */
export function normalizePhone(rawPhone: string | number | undefined): string | null {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already good
  } else if (digits.length > 10) {
    // Valid international/long number
  } else {
    return null;
  }
  return digits;
}

/**
 * Validates Email syntax
 */
export function validateEmail(rawEmail?: string): string | null {
  if (!rawEmail) return null;
  const trimmed = String(rawEmail).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Generates next sequential FMCB ID (e.g. FMCB00001, FMCB00002...)
 */
export async function getNextFmcbId(): Promise<string> {
  const res = await query(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(fmcb_id, '\\D', '', 'g'), '')::int), 0) + 1 as next_id 
    FROM campaign_master_leads
  `);
  const num = parseInt(res.rows[0].next_id, 10);
  return `FMCB${String(num).padStart(5, '0')}`;
}

/**
 * Ingests a batch of raw contact records with zero duplicate upsert,
 * Leads Repository URN lookup, and FMCB ID generation.
 */
export async function ingestContactsBatch(
  contacts: RawContactInput[],
  broadcastId?: string,
  companyName: string = 'OmniReach Global'
): Promise<IngestionResult> {
  const result: IngestionResult = {
    totalProcessed: 0,
    newInserted: 0,
    updatedExisting: 0,
    matchedUrnCount: 0,
    newFmcbCount: 0,
    invalidCount: 0,
    errors: [],
    leadIds: [],
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < contacts.length; i++) {
      const item = contacts[i];
      const normalizedPhone = normalizePhone(item.phone);
      const validatedEmail = validateEmail(item.email);

      if (!normalizedPhone) {
        result.invalidCount++;
        result.errors.push({
          row: i + 1,
          reason: 'Invalid phone number. Must be at least 10 digits.',
          data: item,
        });
        continue;
      }

      result.totalProcessed++;

      // Check if contact already exists in campaign_master_leads
      const existingRes = await client.query(
        'SELECT id, urn, fmcb_id, full_name, email, whatsapp_optin, email_optin FROM campaign_master_leads WHERE phone = $1',
        [normalizedPhone]
      );

      if (existingRes.rows.length > 0) {
        // Contact already exists -> Zero Duplicate Update
        const existing = existingRes.rows[0];
        const leadId = existing.id;
        result.leadIds.push(leadId);
        result.updatedExisting++;

        await client.query(
          `UPDATE campaign_master_leads 
           SET full_name = COALESCE($1, full_name),
               email = COALESCE($2, email),
               address = COALESCE($3, address),
               pan_no = COALESCE($4, pan_no),
               city = COALESCE($5, city),
               company_name = COALESCE(NULLIF($6, 'OmniReach Global'), company_name),
               last_broadcast_id = COALESCE($7, last_broadcast_id),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $8`,
          [
            item.name || null,
            validatedEmail || null,
            item.address || null,
            item.pan_no || null,
            item.city || null,
            companyName,
            broadcastId || null,
            leadId,
          ]
        );
      } else {
        // New Contact -> Check OmniReach Leads Repository for Ground Truth URN
        const repoMatch = await client.query(
          'SELECT urn FROM leads_repository WHERE phone = $1 OR (email IS NOT NULL AND email = $2) LIMIT 1',
          [normalizedPhone, validatedEmail || '']
        );

        let mappedUrn: string | null = null;
        if (repoMatch.rows.length > 0 && repoMatch.rows[0].urn) {
          mappedUrn = repoMatch.rows[0].urn;
          result.matchedUrnCount++;
        }

        // Generate sequential FMCB ID safely
        const syncRes = await client.query(`
          SELECT COALESCE(MAX(NULLIF(regexp_replace(fmcb_id, '\\D', '', 'g'), '')::int), 0) + 1 as next_id 
          FROM campaign_master_leads
        `);
        const nextNum = parseInt(syncRes.rows[0].next_id, 10);
        const fmcbId = `FMCB${String(nextNum).padStart(5, '0')}`;
        result.newFmcbCount++;

        const insertRes = await client.query(
          `INSERT INTO campaign_master_leads 
           (urn, fmcb_id, company_name, full_name, phone, email, address, pan_no, city, custom_attributes, last_broadcast_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            mappedUrn,
            fmcbId,
            companyName,
            item.name || 'Valued Customer',
            normalizedPhone,
            validatedEmail || null,
            item.address || null,
            item.pan_no || null,
            item.city || null,
            JSON.stringify(item.custom_attributes || {}),
            broadcastId || null,
          ]
        );

        result.newInserted++;
        result.leadIds.push(insertRes.rows[0].id);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return result;
}
