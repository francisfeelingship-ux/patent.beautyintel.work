export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const company = url.searchParams.get('company');
  const q = url.searchParams.get('q');
  const country = url.searchParams.get('country');
  const year = url.searchParams.get('year');

  if (!env || !env.DB) {
    return new Response(JSON.stringify({
      error: "D1 Database binding 'DB' unavailable",
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

  try {
    const whereClause = [];
    const params = [];

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

      const searchClauses = [];
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
    const countRes = await env.DB.prepare(countSql).bind(...params).first();
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
      ORDER BY f.member_count DESC, f.priority_date DESC, f.family_id ASC
      LIMIT ? OFFSET ?
    `;

    const itemsRes = await env.DB.prepare(itemsSql).bind(...params, limit, offset).all();
    const familyRows = itemsRes.results || [];

    const familyIds = familyRows.map((r) => r.family_id);
    let tagsByFamily = {};
    let pubByFamily = {};

    if (familyIds.length > 0) {
      const placeholders = familyIds.map(() => '?').join(',');

      const tagsRes = await env.DB.prepare(
        `SELECT family_id, tag FROM family_tags WHERE family_id IN (${placeholders})`
      ).bind(...familyIds).all();

      (tagsRes.results || []).forEach((t) => {
        if (!tagsByFamily[t.family_id]) tagsByFamily[t.family_id] = [];
        if (!tagsByFamily[t.family_id].includes(t.tag)) tagsByFamily[t.family_id].push(t.tag);
      });

      const pubsRes = await env.DB.prepare(
        `SELECT publication_id, publication_number, family_id, title, jurisdiction, priority_date, publication_date 
         FROM publications WHERE family_id IN (${placeholders}) ORDER BY publication_date DESC`
      ).bind(...familyIds).all();

      (pubsRes.results || []).forEach((p) => {
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

    const families = familyRows.map((r) => ({
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
  } catch (err) {
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
