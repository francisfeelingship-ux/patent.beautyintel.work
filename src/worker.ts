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

    if (pathname === '/api/domain-cloud-data') {
      return handleDomainCloudData(request, env);
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

      const nodes = memberRows.map((p: any) => ({
        id: p.publication_number,
        label: p.publication_number,
        type: p.publication_number === repPub ? 'core' : (p.abstract ? 'equivalent_with_text' : 'equivalent'),
        is_representative: Boolean(p.is_public_representative || p.is_technical_representative || p.publication_number === repPub),
        country: p.jurisdiction || p.publication_number?.slice(0, 2) || "US",
        title: p.title || familyRow.display_title,
        assignee: p.assignee_display || familyRow.company_display_name,
        publicationNumber: p.publication_number,
        authority: p.jurisdiction || p.publication_number?.slice(0, 2) || "US",
        kindCode: p.kind_code || "",
        publicationDate: p.publication_date || "",
      }));

      const edges: any[] = [];
      const seenEdges = new Set<string>();

      const byJur: Record<string, any[]> = {};
      memberRows.forEach((m: any) => {
        const jur = m.jurisdiction || m.publication_number?.slice(0, 2) || "US";
        if (!byJur[jur]) byJur[jur] = [];
        byJur[jur].push(m);
      });

      Object.values(byJur).forEach((jurMembers) => {
        const sorted = [...jurMembers].sort((a, b) => {
          const da = a.filing_date || a.publication_date || a.priority_date || "";
          const db = b.filing_date || b.publication_date || b.priority_date || "";
          return da.localeCompare(db);
        });
        for (let i = 1; i < sorted.length; i++) {
          const src = sorted[i - 1].publication_number;
          const tgt = sorted[i].publication_number;
          if (src && tgt && src !== tgt) {
            const key = `${src}->${tgt}`;
            if (!seenEdges.has(key)) {
              seenEdges.add(key);
              edges.push({ source: src, target: tgt, type: "continuation" });
            }
          }
        }
      });

      const primaryId = repPub || memberRows[0]?.publication_number;
      memberRows.forEach((m: any) => {
        const mId = m.publication_number;
        if (mId && mId !== primaryId) {
          const isAlreadyTarget = edges.some((e) => e.target === mId);
          if (!isAlreadyTarget) {
            const key = `${primaryId}->${mId}`;
            if (!seenEdges.has(key)) {
              seenEdges.add(key);
              const edgeType = m.priority_date && m.priority_date === familyRow.priority_date ? "equivalent" : "priority";
              edges.push({ source: primaryId, target: mId, type: edgeType });
            }
          }
        }
      });

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
        nodes,
        edges,
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

const CANONICAL_DOMAINS = [
  'skin_care',
  'hair_care',
  'therapeutic_application',
  'makeup_color_cosmetics',
  'oral_care',
  'cleansing_formula',
  'food_beverage',
  'sunscreen_photoprotection',
  'hair_color'
];

const COMPANY_ALIAS_MAP: Record<string, string[]> = {
  colgate_palmolive: [
    'colgate_palmolive', 'colgate', 'colgate-palmolive', 'colgate_palmolive_company',
    'tom_s_of_maine', 'toms_of_maine', 'toms of maine', 'colgate palmolive', 'colgate-palmolive company'
  ],
  procter_gamble: [
    'procter_gamble', 'procter_and_gamble', 'procter & gamble', 'procter and gamble',
    'p&g', 'pg', 'p_and_g', 'the_procter_gamble_company', 'the procter & gamble company',
    'gillette', 'pantene', 'braun', 'olay', 'wella', 'vicks', 'tampex', 'always', 'head & shoulders'
  ],
  kenvue: [
    'kenvue', 'johnson_johnson', 'johnson & johnson', 'johnson_and_johnson',
    'jnj', 'j_j', 'j&j', 'neutrogena', 'aveeno', 'listerine', 'clean_clear',
    'clean & clear', 'clean_and_clear', 'rogaine', 'tylenol', 'band_aid', 'band-aid', "johnson's"
  ],
  estee_lauder: [
    'estee_lauder', 'esteelauder', 'estée lauder', 'estee lauder', 'elcmanagement',
    'elc_management', 'elc management', 'estee_lauder_inc', 'estee lauder companies',
    'mac', 'mac cosmetics', 'clinique', 'origins', 'aveda', 'bobbi_brown', 'la_mer',
    'too_faced', 'smashbox', 'glamglow', 'tom_ford_beauty', 'le_labo', 'kilian'
  ],
  loreal: [
    'loreal', "l'oreal", 'l_oreal', 'l-oreal', 'loreal_usa', "l'oreal usa",
    'nestle_skin_health', 'beauty_devices', 'lancome', 'lancôme', 'kiehls', 'kiehl_s',
    'garnier', 'maybelline', 'shuuemura', 'shu_uemura', 'skinceuticals', 'skin_ceuticals',
    'cerave', 'la_roche_posay', 'la roche-posay', 'ysl', 'yves_saint_laurent', 'yves saint laurent',
    'it_cosmetics', 'urban_decay', 'nyx', 'matrix', 'redken', 'kerastase', 'kérastase', 'biotherm'
  ],
  shiseido: [
    'shiseido', 'shiseido_company', 'shiseido company', 'shiseido_co', 'bareminerals',
    'nars', 'drunk_elephant', 'drunken_elephant', 'cle_de_peau', 'clé de peau', 'anessa', 'ipsa', 'elixir'
  ],
  beiersdorf: [
    'beiersdorf', 'beiersdorf_ag', 'beiersdorf ag', 'nivea', 'eucerin', 'la_prairie', 'la prairie', 'hansaplast', 'coppertone'
  ],
  unilever: [
    'unilever', 'unilever_nv', 'unilever_plc', 'unilever plc', 'dove', 'axe', 'lynx',
    'rexona', 'sure', 'degree', 'vaseline', 'tresemme', 'sunsilk', 'lux', 'lifebuoy',
    'ponds', 'pond_s', 'simple', 'dermalogica', "paula's choice", 'tatcha', 'liquid_iv'
  ],
  kao_corp: [
    'kao_corp', 'kao', 'kaocorp', 'kao_corporation', 'kao corporation', 'goldwell',
    'kms', 'jergens', 'john_frieda', 'biore', 'bioré', 'molton_brown', 'kanebo', 'sensai', 'curel', 'curél'
  ],
  henkel: [
    'henkel', 'henkel_ag', 'henkel ag', 'schwarzkopf', 'dial', 'syoss', 'got2b', 'fa', 'persil'
  ],
  amorepacific: [
    'amorepacific', 'amorepacific_corp', 'amorepacific corporation', 'sulwhasoo', 'laneige', 'innisfree', 'etude', 'hera', 'ryo'
  ],
  givaudan: ['givaudan', 'givaudan_sa', 'givaudan sa'],
  symrise: ['symrise', 'symrise_ag', 'symrise ag'],
  evonik: ['evonik', 'evonik_industries', 'evonik industries'],
  firmenich: ['firmenich', 'dsm_firmenich', 'dsm-firmenich'],
  dsm: ['dsm', 'royal_dsm', 'dsm_firmenich'],
  dow: ['dow', 'dow_chemical', 'dow chemical', 'dow_dupont'],
  seppic: ['seppic', 'air_liquide_seppic'],
  basf: ['basf', 'basf_se', 'basf se'],
  coty: ['coty', 'coty_inc', 'coty inc', 'covergirl', 'rimmel', 'sally_hansen', 'max_factor'],
  cosmax: ['cosmax', 'cosmax_inc', 'cosmax inc'],
  croda: ['croda', 'croda_international', 'croda international', 'sederma'],
  intercos: ['intercos', 'intercos_spa', 'intercos s.p.a.'],
  ashland: ['ashland', 'ashland_global', 'ashland inc'],
  revlon: ['revlon', 'revlon_consumer_products', 'elizabeth_arden']
};

const ALIAS_TO_PARENT_MAP: Record<string, string> = {};
for (const [parentKey, aliases] of Object.entries(COMPANY_ALIAS_MAP)) {
  for (const alias of aliases) {
    ALIAS_TO_PARENT_MAP[alias.toLowerCase().trim()] = parentKey;
  }
}

function expandCompanyKeys(requestedKeys: string[]): string[] {
  const expanded = new Set<string>();
  for (const key of requestedKeys) {
    const k = key.toLowerCase().trim();
    expanded.add(k);
    if (COMPANY_ALIAS_MAP[k]) {
      for (const alias of COMPANY_ALIAS_MAP[k]) {
        expanded.add(alias.toLowerCase().trim());
      }
    }
  }
  return Array.from(expanded);
}

function resolveParentCompanyKey(dbKey: string | null, requestedParentKeys: string[]): string {
  if (!dbKey) return 'other';
  const k = dbKey.toLowerCase().trim();
  if (requestedParentKeys.includes(k)) return k;
  const parent = ALIAS_TO_PARENT_MAP[k];
  if (parent && requestedParentKeys.includes(parent)) {
    return parent;
  }
  return 'other';
}

function resolveDomain(tag: string | null, title: string | null, pub: string | null): string {
  const text = `${tag || ''} ${title || ''}`.toLowerCase();
  
  if (text.includes('oral') || text.includes('teeth') || text.includes('tooth') || text.includes('dental') || text.includes('mouth') || text.includes('dentifrice') || text.includes('gum') || text.includes('plaque')) {
    return 'oral_care';
  }
  if (text.includes('hair_color') || text.includes('hair color') || text.includes('dye') || text.includes('coloration') || text.includes('bleach')) {
    return 'hair_color';
  }
  if (text.includes('hair') || text.includes('scalp') || text.includes('shampoo') || text.includes('conditioner') || text.includes('follicle')) {
    return 'hair_care';
  }
  if (text.includes('sun') || text.includes('photo') || text.includes('uv') || text.includes('photoprotect') || text.includes('solar') || text.includes('filter')) {
    return 'sunscreen_photoprotection';
  }
  if (text.includes('cleans') || text.includes('wash') || text.includes('soap') || text.includes('shower') || text.includes('hygiene') || text.includes('surfactant') || text.includes('detergent')) {
    return 'cleansing_formula';
  }
  if (text.includes('makeup') || text.includes('make-up') || text.includes('cosmetic') || text.includes('lipstick') || text.includes('mascara') || text.includes('foundation') || text.includes('pigment') || text.includes('nail') || text.includes('lash')) {
    return 'makeup_color_cosmetics';
  }
  if (text.includes('food') || text.includes('beverage') || text.includes('drink') || text.includes('flavor') || text.includes('flavour') || text.includes('taste') || text.includes('edible') || text.includes('nutrition')) {
    return 'food_beverage';
  }
  if (text.includes('therapeutic') || text.includes('pharma') || text.includes('medical') || text.includes('drug') || text.includes('treatment') || text.includes('disease') || text.includes('pathology')) {
    return 'therapeutic_application';
  }
  if (text.includes('skin') || text.includes('dermatol') || text.includes('epiderm') || text.includes('wrinkle') || text.includes('moistur') || text.includes('lotion') || text.includes('cream')) {
    return 'skin_care';
  }

  const hash = Math.abs((pub || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return CANONICAL_DOMAINS[hash % CANONICAL_DOMAINS.length];
}

async function handleDomainCloudData(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const companiesParam = url.searchParams.get('companies');

  const requestedParentKeys = companiesParam
    ? companiesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  if (!env || !env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (requestedParentKeys.length === 0) {
      return new Response(JSON.stringify({ domains: CANONICAL_DOMAINS, points: [] }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      });
    }

    const expandedKeys = expandCompanyKeys(requestedParentKeys);
    const placeholders = expandedKeys.map(() => '?').join(',');

    const sql = `
      SELECT DISTINCT 
        COALESCE(f.public_representative_publication, f.family_id) as pub,
        f.display_title as title,
        ft.tag as domain_tag,
        f.company_key
      FROM families f
      LEFT JOIN family_tags ft ON f.family_id = ft.family_id
      WHERE (f.is_core_family = 1 OR f.is_core_family IS NULL OR f.is_core_family != 0)
        AND LOWER(f.company_key) IN (${placeholders})
      LIMIT 20000
    `;

    const res = await env.DB.prepare(sql).bind(...expandedKeys).all<{
      pub: string;
      title: string;
      domain_tag: string;
      company_key: string;
    }>();

    const rows = res.results || [];
    const patentMap = new Map<string, any>();

    for (const r of rows) {
      const pub = r.pub || 'US20200000000A1';
      const title = r.title || 'Patent Inventions';
      const dbKey = (r.company_key || '').toLowerCase();
      const parentKey = resolveParentCompanyKey(dbKey, requestedParentKeys);

      if (parentKey === 'other') continue;

      const domain = resolveDomain(r.domain_tag, title, pub);

      if (!patentMap.has(pub)) {
        patentMap.set(pub, {
          pub,
          title,
          domain,
          company_key: parentKey,
          is_affiliate: 0
        });
      }
    }

    const points = Array.from(patentMap.values()).map(p => [
      p.pub,
      p.title,
      p.domain,
      p.company_key,
      p.is_affiliate
    ]);

    return new Response(JSON.stringify({ domains: CANONICAL_DOMAINS, points }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err: any) {
    console.error('D1 domain cloud query error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
