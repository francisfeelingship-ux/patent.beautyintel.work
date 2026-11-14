import type { D1Database } from '@cloudflare/workers-types';
import { adminApplicationsPage, publicApplicationPage } from './access-views.ts';

const ADMIN_EMAIL = 'null.pointer@zoho.com';
const ACCESS_ISSUER = 'https://snowy-tree-57a8.cloudflareaccess.com';
const ACCESS_AUDIENCE = 'cf7e08f694dadd97e97a2a5160b2ebee32810a7f61ba44e9d307a1524cdb3447';
const ACCEPTED_USE_CASES = new Set(['patent', 'ingredients', 'competitors', 'research', 'other']);
const RESPONSE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const SUBMITTED = { message: '申请已收到。如符合条件，我们会通过邮件联系你。' };

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface JwtClaims {
  aud?: string | string[];
  iss?: string;
  email?: string;
  exp?: number;
  nbf?: number;
}

interface JsonWebKeyWithId extends JsonWebKey { kid?: string }
let cachedJwks: { keys: JsonWebKeyWithId[]; fetchedAt: number } | null = null;

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: RESPONSE_HEADERS });
}

function html(page: string): Response {
  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function decodeJwtPart(part: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Malformed token');
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function getAccessJwks(force = false): Promise<JsonWebKeyWithId[]> {
  if (!force && cachedJwks && Date.now() - cachedJwks.fetchedAt < 60 * 60 * 1000) {
    return cachedJwks.keys;
  }
  const result = await fetch(`${ACCESS_ISSUER}/cdn-cgi/access/certs`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!result.ok) throw new Error('Access identity provider unavailable');
  const json = await result.json() as { keys?: JsonWebKeyWithId[] };
  if (!Array.isArray(json.keys)) throw new Error('Invalid Access keys');
  cachedJwks = { keys: json.keys, fetchedAt: Date.now() };
  return json.keys;
}

/** Never trust a caller-supplied email header: validate the Cloudflare Access JWT. */
export async function verifiedAdminEmail(request: Request): Promise<string | null> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3 || jwt.length > 12000) return null;

  try {
    const header = decodeJwtPart(parts[0]) as { alg?: string; kid?: string };
    const claims = decodeJwtPart(parts[1]) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== ACCESS_ISSUER) return null;
    if (!claims.exp || claims.exp <= now || (claims.nbf && claims.nbf > now)) return null;
    if (!(Array.isArray(claims.aud) ? claims.aud.includes(ACCESS_AUDIENCE) : claims.aud === ACCESS_AUDIENCE)) return null;
    if (claims.email?.toLowerCase() !== ADMIN_EMAIL) return null;

    let keys = await getAccessJwks();
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) {
      keys = await getAccessJwks(true);
      jwk = keys.find(k => k.kid === header.kid);
    }
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signature = decodeBase64Url(parts[2]);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return verified ? ADMIN_EMAIL : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(part: string): Uint8Array {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), c => c.charCodeAt(0));
}

async function submitApplication(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return response({ error: 'Invalid origin' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Expected JSON' }, 415);
  }
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > 4096) return response({ error: 'Request too large' }, 413);

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 4096) return response({ error: 'Request too large' }, 413);
    body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {
    return response({ error: 'Invalid request' }, 400);
  }

  if (body.website) return response(SUBMITTED, 202); // Hidden spam trap.
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const organization = typeof body.organization === 'string' ? body.organization.trim() : '';
  const useCase = typeof body.useCase === 'string' ? body.useCase : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (fullName.length < 2 || fullName.length > 100 || organization.length < 2 || organization.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !ACCEPTED_USE_CASES.has(useCase) || message.length > 1000) {
    return response({ error: '请检查姓名、企业邮箱、公司和申请用途。' }, 400);
  }

  try {
    await db.prepare(
      `INSERT OR IGNORE INTO access_requests
       (id, full_name, email, organization, use_case, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), fullName, email, organization, useCase, message).run();
    return response(SUBMITTED, 202); // Same response for duplicate emails (no enumeration).
  } catch (error) {
    console.error('Access application submission failed:', error);
    return response({ error: '服务暂时不可用，请稍后再试。' }, 503);
  }
}

async function listApplications(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'GET') return response({ error: 'Method not allowed' }, 405);
  const params = new URL(request.url).searchParams;
  const status = params.get('status') || 'all';
  if (!['all', 'pending', 'approved', 'rejected'].includes(status)) return response({ error: 'Invalid status' }, 400);
  try {
    const list = await db.prepare(
      `SELECT id, full_name, email, organization, use_case, message, status,
              review_note, reviewed_by, reviewed_at, created_at
       FROM access_requests
       WHERE (? = 'all' OR status = ?)
       ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 100`
    ).bind(status, status).all();
    const totals = await db.prepare(
      'SELECT status, COUNT(*) AS count FROM access_requests GROUP BY status'
    ).all<{ status: string; count: number }>();
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of totals.results || []) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
    }
    return response({ applications: list.results || [], counts });
  } catch (error) {
    console.error('Access application list failed:', error);
    return response({ error: 'Database unavailable' }, 503);
  }
}

async function decideApplication(request: Request, db: D1Database, id: string, reviewer: string): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return response({ error: 'Invalid origin' }, 403);
  if (!/^[0-9a-f-]{36}$/.test(id)) return response({ error: 'Invalid application ID' }, 400);
  let data: { decision?: string; note?: string };
  try {
    const raw = await request.text();
    if (raw.length > 1500) return response({ error: 'Request too large' }, 413);
    data = JSON.parse(raw);
  } catch {
    return response({ error: 'Invalid JSON' }, 400);
  }
  const decision = data?.decision as ApplicationStatus;
  const note = typeof data?.note === 'string' ? data.note.trim() : '';
  if (!['approved', 'rejected'].includes(decision) || note.length > 500) {
    return response({ error: 'Invalid decision' }, 400);
  }
  try {
    const result = await db.prepare(
      `UPDATE access_requests
       SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'pending'
       RETURNING id, status, email`
    ).bind(decision, note, reviewer, id).first<{ id: string; status: string; email: string }>();
    if (!result) return response({ error: '申请不存在或已完成审核，请刷新列表。' }, 409);
    return response({ ...result, accessProvisioned: false,
      message: '审批已保存。Cloudflare Access 的实际账号放行仍需单独配置。' });
  } catch (error) {
    console.error('Access application decision failed:', error);
    return response({ error: 'Database unavailable' }, 503);
  }
}

export async function handleAccessRoute(request: Request, db: D1Database): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/apply') {
    return request.method === 'GET' ? html(publicApplicationPage) : response({ error: 'Method not allowed' }, 405);
  }
  if (path === '/api/access-requests') return submitApplication(request, db);

  const adminPaths = path === '/admin/applications' || path === '/api/admin/applications' ||
    /^\/api\/admin\/applications\/[0-9a-f-]{36}\/decision$/.test(path);
  if (!adminPaths) return null;

  const reviewer = await verifiedAdminEmail(request);
  if (!reviewer) return response({ error: 'Administrator authentication required' }, 401);
  if (path === '/admin/applications') {
    return request.method === 'GET' ? html(adminApplicationsPage) : response({ error: 'Method not allowed' }, 405);
  }
  if (path === '/api/admin/applications') return listApplications(request, db);
  return decideApplication(request, db, path.split('/')[4], reviewer);
}
