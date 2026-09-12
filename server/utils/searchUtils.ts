import { AuthenticatedRequest } from '../middleware/auth';

export function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `LOWER(TRIM(company_name)) = LOWER(TRIM($${startingIndex}))`, params: [String(company_name).trim()] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `LOWER(TRIM(company_name)) = LOWER(TRIM($${startingIndex}))`, params: [String(compName).trim()] };
}

export function buildSearchClauses(searchStr: string, startingParamIdx: number): { clause: string; params: any[] } {
  const rawSearch = String(searchStr).trim();
  if (!rawSearch) return { clause: '', params: [] };

  const params: any[] = [];
  const orConditions: string[] = [];

  const addParam = (val: any) => {
    params.push(val);
    return `$${startingParamIdx + params.length - 1}`;
  };

  // 1. Check if searching by Company Initial + Sr. No (e.g. #S1, S1, #O25, O25)
  const initialMatch = rawSearch.match(/^#?\s*([A-Za-z])\s*(\d+)$/i);
  if (initialMatch) {
    const initialChar = initialMatch[1].toUpperCase();
    const num = parseInt(initialMatch[2], 10);
    if (!isNaN(num) && num > 0) {
      const pNum = addParam(num);
      const pInit = addParam(`${initialChar}%`);
      orConditions.push(`(COALESCE(company_sr_no, sr_no) = ${pNum} AND company_name ILIKE ${pInit})`);
    }
  }

  // Check if searching by numeric Sr. No (e.g. #6, # 6, or pure numeric up to 8 digits)
  let srNoCandidate: number | null = null;
  if (rawSearch.startsWith('#')) {
    const parsed = parseInt(rawSearch.replace(/^#\s*/, ''), 10);
    if (!isNaN(parsed) && parsed > 0) srNoCandidate = parsed;
  } else if (/^\d{1,8}$/.test(rawSearch)) {
    const parsed = parseInt(rawSearch, 10);
    if (!isNaN(parsed) && parsed > 0) srNoCandidate = parsed;
  }

  if (srNoCandidate !== null) {
    const p = addParam(srNoCandidate);
    orConditions.push(`(company_sr_no = ${p} OR sr_no = ${p})`);
  }

  // 2. Phone variants
  const digitsOnly = rawSearch.replace(/\D/g, '');
  const isPhoneLikeSearch = digitsOnly.length >= 7;

  if (isPhoneLikeSearch) {
    const p1 = addParam(`%${digitsOnly}%`);
    orConditions.push(`phone ILIKE ${p1}`);

    if (digitsOnly.length === 10) {
      const p2 = addParam(`%91${digitsOnly}%`);
      orConditions.push(`phone ILIKE ${p2}`);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      const core = digitsOnly.substring(1);
      const p2 = addParam(`%${core}%`);
      const p3 = addParam(`%91${core}%`);
      orConditions.push(`phone ILIKE ${p2}`, `phone ILIKE ${p3}`);
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      const core = digitsOnly.substring(2);
      const p2 = addParam(`%${core}%`);
      orConditions.push(`phone ILIKE ${p2}`);
    }
    // For phone-like searches, DON'T search name/city/address/pan — too broad and slow
  }

  // 3. Email specific search
  if (rawSearch.includes('@')) {
    const pEmail = addParam(`%${rawSearch}%`);
    orConditions.push(`email ILIKE ${pEmail}`);
  }

  // 4. OMCB / FMCB or URN specific search
  if (rawSearch.toUpperCase().startsWith('OMCB') || rawSearch.toUpperCase().startsWith('FMCB') || (rawSearch.toUpperCase().startsWith('OM') && /\d/.test(rawSearch))) {
    const pFmcb = addParam(`%${rawSearch}%`);
    orConditions.push(`fmcb_id ILIKE ${pFmcb}`);
  } else if (rawSearch.toUpperCase().startsWith('URN')) {
    const pUrn = addParam(`%${rawSearch}%`);
    orConditions.push(`urn ILIKE ${pUrn}`);
  }

  // 5. General text search — ONLY for non-phone-like queries
  if (!isPhoneLikeSearch) {
    const pGen = addParam(`%${rawSearch}%`);
    orConditions.push(
      `full_name ILIKE ${pGen}`,
      `city ILIKE ${pGen}`,
      `address ILIKE ${pGen}`,
      `pan_no ILIKE ${pGen}`
    );
    if (!rawSearch.includes('@')) {
      orConditions.push(`email ILIKE ${pGen}`);
    }
    orConditions.push(`phone ILIKE ${pGen}`);
    if (!rawSearch.toUpperCase().startsWith('URN')) {
      orConditions.push(`urn ILIKE ${pGen}`);
    }
    if (!rawSearch.toUpperCase().startsWith('OMCB') && !rawSearch.toUpperCase().startsWith('FMCB')) {
      orConditions.push(`fmcb_id ILIKE ${pGen}`);
    }
  }

  if (orConditions.length === 0) return { clause: '', params: [] };

  console.log(`[SearchUtils] query: "${rawSearch}", ${orConditions.length} clauses, ${params.length} params`);

  return {
    clause: `(${orConditions.join(' OR ')})`,
    params,
  };
}

export function buildLeadsWhereClause(req: AuthenticatedRequest) {
  const { search, optin_filter, channel_filter, sr_no_start, sr_no_end } = req.query;
  const params: any[] = [];
  const whereClauses: string[] = [];

  const compCond = getCompanyCondition(req, params.length + 1);
  if (compCond.clause) {
    whereClauses.push(compCond.clause);
    params.push(...compCond.params);
  }

  if (search && String(search).trim().length > 0) {
    const searchCond = buildSearchClauses(String(search), params.length + 1);
    if (searchCond.clause) {
      whereClauses.push(searchCond.clause);
      params.push(...searchCond.params);
    }
  }

  if (sr_no_start) {
    const s = parseInt(sr_no_start as string, 10);
    if (!isNaN(s)) {
      params.push(s);
      whereClauses.push(`COALESCE(company_sr_no, sr_no) >= $${params.length}`);
    }
  }
  if (sr_no_end) {
    const e = parseInt(sr_no_end as string, 10);
    if (!isNaN(e)) {
      params.push(e);
      whereClauses.push(`COALESCE(company_sr_no, sr_no) <= $${params.length}`);
    }
  }

  if (channel_filter === 'phone_only') {
    whereClauses.push(`phone IS NOT NULL AND phone != ''`);
  } else if (channel_filter === 'email_only') {
    whereClauses.push(`email IS NOT NULL AND email != ''`);
  } else if (channel_filter === 'both') {
    whereClauses.push(`phone IS NOT NULL AND phone != '' AND email IS NOT NULL AND email != ''`);
  }

  if (optin_filter === 'whatsapp_optin') {
    whereClauses.push('whatsapp_optin = true');
  } else if (optin_filter === 'email_optin') {
    whereClauses.push('email_optin = true');
  } else if (optin_filter === 'whatsapp_optout') {
    whereClauses.push('whatsapp_optin = false');
  } else if (optin_filter === 'email_optout') {
    whereClauses.push('email_optin = false');
  } else if (optin_filter === 'all_optout') {
    whereClauses.push('(whatsapp_optin = false AND email_optin = false)');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, params };
}
