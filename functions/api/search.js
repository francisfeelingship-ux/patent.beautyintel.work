export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const company = url.searchParams.get('company');

  if (!q || q.trim().length === 0) {
    return new Response(JSON.stringify({ results: [], total: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const whereClause = ["family_search MATCH ?"];
    const params = [q.trim()];

    if (company) {
      whereClause.push("f.company_key = ?");
      params.push(company);
    }

    const whereStr = " WHERE " + whereClause.join(" AND ");

    const sql = `
      SELECT 
        f.family_id,
        f.public_representative_publication,
        f.display_title,
        f.display_abstract,
        f.company_key,
        f.company_display_name,
        f.priority_date,
        f.member_count,
        f.jurisdiction_count
      FROM family_search fs
      JOIN families f ON fs.family_id = f.family_id
      ${whereStr}
      LIMIT 50
    `;

    const res = await env.DB.prepare(sql).bind(...params).all();
    const rows = res.results || [];

    const results = rows.map((r) => ({
      family_id: r.family_id,
      public_id: r.public_representative_publication || r.family_id,
      display_title: r.display_title,
      display_abstract: r.display_abstract || "",
      company_name: r.company_display_name,
      priority_date: r.priority_date || "",
      member_count: r.member_count,
      jurisdiction_count: r.jurisdiction_count,
    }));

    return new Response(JSON.stringify({ total: results.length, results }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to search D1 database" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
