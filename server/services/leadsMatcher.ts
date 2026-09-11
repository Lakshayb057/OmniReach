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
    SELECT COALESCE(MAX(NULLIF(regexp_replace(fmcb_id, '[^0-9]', '', 'g'), '')::int), 0) + 1 as next_id 
    FROM campaign_master_leads
  `);
  const num = parseInt(res.rows[0].next_id, 10);
  return `FMCB${String(num).padStart(5, '0')}`;
}

/**
 * Ingests a batch of raw contact records with zero duplicate upsert,
 * Leads Repository URN lookup, and FMCB ID generation.
 * Optimized for ultra-high throughput (lakhs / 100,000+ contacts) using
 * chunked multi-row batch upserts and PostgreSQL native sequences.
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

  if (!contacts || contacts.length === 0) return result;

  // 1. In-memory validation, normalization, and deduplication across file
  // Using Map keyed by normalized phone to prevent intra-batch unique conflicts
  const validContactsMap = new Map<string, { item: RawContactInput; email: string | null }>();

  for (let i = 0; i < contacts.length; i++) {
    const item = contacts[i];
    const phone = normalizePhone(item.phone);
    const email = validateEmail(item.email);

    if (!phone) {
      result.invalidCount++;
      if (result.errors.length < 50) {
        result.errors.push({
          row: i + 1,
          reason: 'Invalid phone number. Must be at least 10 digits.',
          data: item,
        });
      }
      continue;
    }

    result.totalProcessed++;
    // Overwrite with latest entry for this phone if duplicate in the same file
    validContactsMap.set(phone, { item, email });
  }

  const validEntries = Array.from(validContactsMap.entries());
  if (validEntries.length === 0) return result;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure fmcb_id_seq is synchronized with current max
    await client.query(`
      SELECT setval('fmcb_id_seq', GREATEST(COALESCE((SELECT MAX(NULLIF(regexp_replace(fmcb_id, '[^0-9]', '', 'g'), '')::bigint) FROM campaign_master_leads), 0), 1), false);
    `);

    // Process in chunks of 1,000 contacts for ultra-high speed and low memory
    const CHUNK_SIZE = 1000;

    for (let c = 0; c < validEntries.length; c += CHUNK_SIZE) {
      const chunk = validEntries.slice(c, c + CHUNK_SIZE);
      const chunkPhones = chunk.map(([phone]) => phone);
      const chunkEmails = chunk.map(([, data]) => data.email).filter(Boolean) as string[];

      // Fast Bulk Lookup in Leads Repository for Ground Truth URN in 1 query
      const repoUrnMap = new Map<string, string>();
      if (chunkPhones.length > 0) {
        const repoRes = await client.query(
          `SELECT urn, phone, email 
           FROM leads_repository 
           WHERE phone = ANY($1) OR (email IS NOT NULL AND email = ANY($2))`,
          [chunkPhones, chunkEmails]
        );
        for (const r of repoRes.rows) {
          if (r.phone) repoUrnMap.set(r.phone, r.urn);
          if (r.email) repoUrnMap.set(r.email.toLowerCase(), r.urn);
        }
      }

      // Build Multi-row UPSERT query for this chunk
      // Each row takes 10 parameters
      const queryParams: any[] = [];
      const rowTuples: string[] = [];

      for (let i = 0; i < chunk.length; i++) {
        const [phone, data] = chunk[i];
        const item = data.item;
        const mappedUrn = repoUrnMap.get(phone) || (data.email ? repoUrnMap.get(data.email) : null) || null;
        if (mappedUrn) result.matchedUrnCount++;

        const offset = i * 10;
        rowTuples.push(
          `($${offset + 1}, 'FMCB' || LPAD(nextval('fmcb_id_seq')::text, 5, '0'), $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, CURRENT_TIMESTAMP)`
        );

        queryParams.push(
          mappedUrn,
          companyName,
          item.name || 'Valued Customer',
          phone,
          data.email,
          item.address || null,
          item.pan_no || null,
          item.city || null,
          JSON.stringify(item.custom_attributes || {}),
          broadcastId || null
        );
      }

      const upsertSql = `
        INSERT INTO campaign_master_leads 
        (urn, fmcb_id, company_name, full_name, phone, email, address, pan_no, city, custom_attributes, last_broadcast_id, updated_at)
        VALUES ${rowTuples.join(',\n')}
        ON CONFLICT (phone) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          email = COALESCE(EXCLUDED.email, campaign_master_leads.email),
          address = COALESCE(EXCLUDED.address, campaign_master_leads.address),
          pan_no = COALESCE(EXCLUDED.pan_no, campaign_master_leads.pan_no),
          city = COALESCE(EXCLUDED.city, campaign_master_leads.city),
          company_name = COALESCE(NULLIF(EXCLUDED.company_name, 'OmniReach Global'), campaign_master_leads.company_name),
          last_broadcast_id = COALESCE(EXCLUDED.last_broadcast_id, campaign_master_leads.last_broadcast_id),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, (xmax = 0) AS is_inserted
      `;

      const chunkRes = await client.query(upsertSql, queryParams);

      for (const row of chunkRes.rows) {
        result.leadIds.push(row.id);
        if (row.is_inserted) {
          result.newInserted++;
          result.newFmcbCount++;
        } else {
          result.updatedExisting++;
        }
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
