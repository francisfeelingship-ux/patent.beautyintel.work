export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route /api/* requests to D1 queries
    if (pathname === '/api/analytics') {
      return handleAnalytics(request, env);
    }

    if (pathname === '/api/families') {
      return handleFamilies(request, env);
    }

    if (pathname.startsWith('/api/family/')) {
      const familyId = decodeURIComponent(pathname.replace('/api/family/', ''));
      return handleFamilyDetail(familyId, env);
    }

    // Serve static assets for all other routes
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleAnalytics(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const companyFilter = url.searchParams.get('company');

  try {
    let totalPatentsQuery = "SELECT COUNT(*) as cnt FROM publications";
    let totalFamiliesQuery = "SELECT COUNT(*) as cnt FROM families";
    const totalPatentsParams: any[] = [];
    const totalFamiliesParams: any[] = [];

    if (companyFilter) {
      totalPatentsQuery += " WHERE company_key = ?";
      totalPatentsParams.push(companyFilter);
      totalFamiliesQuery += " WHERE company_key = ?";
      totalFamiliesParams.push(companyFilter);
    }

    const patentsRes = await env.DB.prepare(totalPatentsQuery).bind(...totalPatentsParams).first<{ cnt: number }>();
    const familiesRes = await env.DB.prepare(totalFamiliesQuery).bind(...totalFamiliesParams).first<{ cnt: number }>();

    const total_patents = patentsRes?.cnt || 0;
    const total_families = familiesRes?.cnt || 0;

    const companyRows = await env.DB.prepare(
      `SELECT company_key, company_display_name as name, COUNT(*) as family_count 
       FROM families 
       WHERE company_key IS NOT NULL 
       GROUP BY company_key, company_display_name 
       ORDER BY family_count DESC`
    ).all<{ company_key: string; name: string; family_count: number }>();

    const companies = (companyRows.results || []).map((c) => ({
      key: c.company_key,
      name: c.name,
      families_count: c.family_count,
    }));

    let yearlySql = `
      SELECT strftime('%Y', priority_date) as year, COUNT(*) as cnt 
      FROM families 
      WHERE priority_date IS NOT NULL AND strftime('%Y', priority_date) >= '1990'
    `;
    const yearlyParams: any[] = [];
    if (companyFilter) {
      yearlySql += " AND company_key = ?";
      yearlyParams.push(companyFilter);
    }
    yearlySql += " GROUP BY year ORDER BY year ASC";

    const yearlyRows = await env.DB.prepare(yearlySql).bind(...yearlyParams).all<{ year: string; cnt: number }>();
    const yearly_patent_families: Record<string, number> = {};
    let peak_year = 2023;
    let maxYearCnt = 0;

    (yearlyRows.results || []).forEach((row) => {
      if (row.year) {
        const yr = parseInt(row.year, 10);
        yearly_patent_families[row.year] = row.cnt;
        if (row.cnt > maxYearCnt) {
          maxYearCnt = row.cnt;
          peak_year = yr;
        }
      }
    });

    let tagSql = `
      SELECT ft.tag, COUNT(*) as cnt 
      FROM family_tags ft
    `;
    const tagParams: any[] = [];
    if (companyFilter) {
      tagSql += " JOIN families f ON ft.family_id = f.family_id WHERE f.company_key = ?";
      tagParams.push(companyFilter);
    }
    tagSql += " GROUP BY ft.tag ORDER BY cnt DESC LIMIT 15";

    const tagRows = await env.DB.prepare(tagSql).bind(...tagParams).all<{ tag: string; cnt: number }>();
    const domain_distribution: Record<string, number> = {};
    let top_domain = "Skin Care";
    let maxDomainCnt = 0;

    (tagRows.results || []).forEach((row) => {
      domain_distribution[row.tag] = row.cnt;
      if (row.cnt > maxDomainCnt) {
        maxDomainCnt = row.cnt;
        top_domain = row.tag;
      }
    });

    let jurSql = `
      SELECT fj.jurisdiction, SUM(fj.publication_count) as cnt 
      FROM family_jurisdictions fj
    `;
    const jurParams: any[] = [];
    if (companyFilter) {
      jurSql += " JOIN families f ON fj.family_id = f.family_id WHERE f.company_key = ?";
      jurParams.push(companyFilter);
    }
    jurSql += " GROUP BY fj.jurisdiction ORDER BY cnt DESC";

    const jurRows = await env.DB.prepare(jurSql).bind(...jurParams).all<{ jurisdiction: string; cnt: number }>();
    const country_densities: Record<string, number> = {};
    let top_authority = "US";
    let maxJurCnt = 0;

    (jurRows.results || []).forEach((row) => {
      country_densities[row.jurisdiction] = row.cnt;
      if (row.cnt > maxJurCnt && !["WO", "EP", "IB"].includes(row.jurisdiction)) {
        maxJurCnt = row.cnt;
        top_authority = row.jurisdiction;
      }
    });

    const responsePayload = {
      global: {
        total_patents,
        total_families,
        top_authority,
        top_domain,
        peak_year,
        yearly_patent_families,
        domain_distribution,
        country_densities,
      },
      companies,
      company_data: companyFilter
        ? {
            [companyFilter]: {
              total_patents,
              total_families,
              top_authority,
              top_domain,
              peak_year,
              yearly_patent_families,
              domain_distribution,
              country_densities,
            },
          }
        : {},
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err: any) {
    console.error("D1 analytics query error:", err);
    return new Response(JSON.stringify({ error: err.message || "Database query error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleFamilies(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return new Response(JSON.stringify({
      error: "D1 Database binding 'DB' unavailable",
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
      families: [],
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const company = url.searchParams.get('company');
  const q = url.searchParams.get('q');
  const country = url.searchParams.get('country');
  const year = url.searchParams.get('year');

  try {
    const whereClause: string[] = [];
    const params: any[] = [];

    if (company) {
      whereClause.push("f.company_key = ?");
      params.push(company);
    }

    if (year) {
      whereClause.push("strftime('%Y', f.priority_date) = ?");
      params.push(year);
    }

    if (country) {
      whereClause.push("EXISTS (SELECT 1 FROM family_jurisdictions fj WHERE fj.family_id = f.family_id AND fj.jurisdiction = ?)");
      params.push(country);
    }

    if (q && q.trim().length > 0) {
      const cleanQ = q.trim();
      const safeTerms = cleanQ.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);

      const searchClauses: string[] = [];
      if (safeTerms.length > 0) {
        const ftsExpr = safeTerms.map(t => `"${t}"*`).join(' AND ');
        searchClauses.push("f.family_id IN (SELECT family_id FROM family_search WHERE family_search MATCH ?)");
        params.push(ftsExpr);
      }

      searchClauses.push("f.public_representative_publication LIKE ?");
      params.push(`%${cleanQ}%`);
      searchClauses.push("f.family_id LIKE ?");
      params.push(`%${cleanQ}%`);
      searchClauses.push("f.display_title LIKE ?");
      params.push(`%${cleanQ}%`);
      searchClauses.push("f.display_abstract LIKE ?");
      params.push(`%${cleanQ}%`);
      searchClauses.push("f.family_id IN (SELECT family_id FROM publications WHERE publication_number LIKE ? OR title LIKE ?)");
      params.push(`%${cleanQ}%`, `%${cleanQ}%`);

      whereClause.push(`(${searchClauses.join(" OR ")})`);
    }

    const whereStr = whereClause.length > 0 ? " WHERE " + whereClause.join(" AND ") : "";

    const countSql = `SELECT COUNT(DISTINCT f.family_id) as cnt FROM families f${whereStr}`;
    const countRes = await env.DB.prepare(countSql).bind(...params).first<{ cnt: number }>();
    const totalCount = countRes?.cnt || 0;

    const itemsSql = `
      SELECT DISTINCT 
        f.family_id,
        f.public_representative_publication,
        f.display_title,
        f.display_abstract,
        f.company_key,
        f.company_display_name,
        f.priority_date,
        f.member_count,
        f.jurisdiction_count,
        f.is_core_family
      FROM families f
      ${whereStr}
      ORDER BY f.priority_date DESC, f.family_id ASC
      LIMIT ? OFFSET ?
    `;

    const itemsRes = await env.DB.prepare(itemsSql).bind(...params, limit, offset).all<any>();
    const familyRows = itemsRes.results || [];

    const familyIds = familyRows.map((r: any) => r.family_id);
    let tagsByFamily: Record<string, string[]> = {};
    let pubByFamily: Record<string, any[]> = {};

    if (familyIds.length > 0) {
      const placeholders = familyIds.map(() => '?').join(',');

      const tagsRes = await env.DB.prepare(
        `SELECT family_id, tag FROM family_tags WHERE family_id IN (${placeholders})`
      ).bind(...familyIds).all<{ family_id: string; tag: string }>();

      (tagsRes.results || []).forEach((t) => {
        if (!tagsByFamily[t.family_id]) tagsByFamily[t.family_id] = [];
        if (!tagsByFamily[t.family_id].includes(t.tag)) tagsByFamily[t.family_id].push(t.tag);
      });

      const pubsRes = await env.DB.prepare(
        `SELECT publication_id, publication_number, family_id, title, jurisdiction, priority_date, publication_date 
         FROM publications WHERE family_id IN (${placeholders}) ORDER BY publication_date DESC`
      ).bind(...familyIds).all<any>();

      (pubsRes.results || []).forEach((p: any) => {
        if (!pubByFamily[p.family_id]) pubByFamily[p.family_id] = [];
        pubByFamily[p.family_id].push({
          id: p.publication_number,
          authority: p.jurisdiction,
          title: p.title,
          priority_date: p.priority_date,
          publication_date: p.publication_date,
        });
      });
    }

    const families = familyRows.map((r: any) => ({
      family_id: r.family_id,
      public_id: r.public_representative_publication || r.family_id,
      display_title: r.display_title,
      display_abstract: r.display_abstract || "",
      company_key: r.company_key,
      company_name: r.company_display_name,
      priority_date: r.priority_date || "",
      member_count: r.member_count,
      jurisdiction_count: r.jurisdiction_count,
      is_core_family: Boolean(r.is_core_family),
      tags: tagsByFamily[r.family_id] || [],
      members: pubByFamily[r.family_id] || [],
    }));

    return new Response(JSON.stringify({
      total: totalCount,
      page,
      limit,
      total_pages: Math.ceil(totalCount / limit),
      families,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (err: any) {
    console.error("D1 families query error:", err);
    return new Response(JSON.stringify({
      error: err.message || "Database query failed",
      total: 0,
      page,
      limit,
      total_pages: 0,
      families: [],
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleFamilyDetail(familyIdOrPublicId: string, env: Env): Promise<Response> {
  if (!familyIdOrPublicId) {
    return new Response(JSON.stringify({ error: "Missing family ID" }), { status: 400 });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' unavailable" }), { status: 500 });
  }

  try {
    let familyRow = await env.DB.prepare(
      `SELECT * FROM families WHERE family_id = ? OR public_representative_publication = ? LIMIT 1`
    ).bind(familyIdOrPublicId, familyIdOrPublicId).first<any>();

    let pubRow: any = null;
    if (!familyRow) {
      pubRow = await env.DB.prepare(
        `SELECT * FROM publications WHERE publication_number = ? OR publication_id = ? LIMIT 1`
      ).bind(familyIdOrPublicId, familyIdOrPublicId).first<any>();

      if (pubRow && pubRow.family_id) {
        familyRow = await env.DB.prepare(
          `SELECT * FROM families WHERE family_id = ? LIMIT 1`
        ).bind(pubRow.family_id).first<any>();
      }
    }

    if (familyRow) {
      const family_id = familyRow.family_id;

      const pubsRes = await env.DB.prepare(
        `SELECT * FROM publications WHERE family_id = ? ORDER BY publication_date DESC`
      ).bind(family_id).all<any>();

      const tagsRes = await env.DB.prepare(
        `SELECT tag FROM family_tags WHERE family_id = ?`
      ).bind(family_id).all<{ tag: string }>();

      const jurRes = await env.DB.prepare(
        `SELECT jurisdiction, publication_count FROM family_jurisdictions WHERE family_id = ?`
      ).bind(family_id).all<any>();

      let memberRows = pubsRes.results || [];
      if (memberRows.length === 0 && pubRow) {
        memberRows = [pubRow];
      }

      const repPub = familyRow.public_representative_publication || (memberRows[0]?.publication_number);

      const payload = {
        family_id: familyRow.family_id,
        public_id: familyRow.public_representative_publication || familyRow.family_id,
        display_title: familyRow.display_title || memberRows[0]?.title || familyRow.family_id,
        display_abstract: familyRow.display_abstract || memberRows[0]?.abstract || "",
        company_key: familyRow.company_key || "unknown",
        company_name: familyRow.company_display_name || memberRows[0]?.assignee_display || "Assignee",
        priority_date: familyRow.priority_date || memberRows[0]?.priority_date || "",
        member_count: familyRow.member_count || memberRows.length,
        jurisdiction_count: familyRow.jurisdiction_count || 1,
        is_core_family: Boolean(familyRow.is_core_family),
        tags: (tagsRes.results || []).map((t) => t.tag),
        jurisdictions: jurRes.results || [],
        members: memberRows.map((p: any) => ({
          id: p.publication_number,
          authority: p.jurisdiction || p.publication_number?.slice(0, 2) || "US",
          title: p.title || familyRow.display_title,
          abstract: p.abstract || "",
          assignee: p.assignee_display || familyRow.company_display_name,
          priority_date: p.priority_date || "",
          filing_date: p.filing_date || "",
          publication_date: p.publication_date || "",
          is_representative: Boolean(p.is_public_representative || p.is_technical_representative || p.publication_number === repPub),
        })),
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=600",
        },
      });
    }

    if (pubRow) {
      const payload = {
        family_id: pubRow.family_id || `FAM_${pubRow.publication_number}`,
        public_id: pubRow.publication_number,
        display_title: pubRow.title || pubRow.publication_number,
        display_abstract: pubRow.abstract || "",
        company_key: pubRow.assignee_display ? pubRow.assignee_display.toLowerCase().replace(/[^a-z0-9]/g, '_') : "unknown",
        company_name: pubRow.assignee_display || "Assignee",
        priority_date: pubRow.priority_date || pubRow.publication_date || "",
        member_count: 1,
        jurisdiction_count: 1,
        is_core_family: false,
        tags: [],
        jurisdictions: [{ jurisdiction: pubRow.jurisdiction || "US", publication_count: 1 }],
        members: [{
          id: pubRow.publication_number,
          authority: pubRow.jurisdiction || pubRow.publication_number?.slice(0, 2) || "US",
          title: pubRow.title || pubRow.publication_number,
          abstract: pubRow.abstract || "",
          assignee: pubRow.assignee_display || "Assignee",
          priority_date: pubRow.priority_date || "",
          filing_date: pubRow.filing_date || "",
          publication_date: pubRow.publication_date || "",
          is_representative: true,
        }],
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=600",
        },
      });
    }

    return new Response(JSON.stringify({ error: `Family '${familyIdOrPublicId}' not found in D1` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("D1 family detail query error:", err);
    return new Response(JSON.stringify({ error: err.message || "Database query error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
