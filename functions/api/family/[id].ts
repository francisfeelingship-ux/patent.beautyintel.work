interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const familyIdOrPublicId = params.id as string;

  if (!familyIdOrPublicId) {
    return new Response(JSON.stringify({ error: "Missing family ID" }), { status: 400 });
  }

  try {
    // 1. Find family row by family_id or public_representative_publication
    let familyRow = await env.DB.prepare(
      `SELECT * FROM families WHERE family_id = ? OR public_representative_publication = ? LIMIT 1`
    ).bind(familyIdOrPublicId, familyIdOrPublicId).first<any>();

    if (!familyRow) {
      return new Response(JSON.stringify({ error: `Family ${familyIdOrPublicId} not found` }), { status: 404 });
    }

    const family_id = familyRow.family_id;

    // 2. Fetch all publications for this family
    const pubsRes = await env.DB.prepare(
      `SELECT * FROM publications WHERE family_id = ? ORDER BY publication_date DESC`
    ).bind(family_id).all<any>();

    // 3. Fetch tags for this family
    const tagsRes = await env.DB.prepare(
      `SELECT tag FROM family_tags WHERE family_id = ?`
    ).bind(family_id).all<{ tag: string }>();

    // 4. Fetch jurisdictions for this family
    const jurRes = await env.DB.prepare(
      `SELECT jurisdiction, publication_count FROM family_jurisdictions WHERE family_id = ?`
    ).bind(family_id).all<{ jurisdiction: string; publication_count: number }>();

    const payload = {
      family_id: familyRow.family_id,
      public_id: familyRow.public_representative_publication || familyRow.family_id,
      display_title: familyRow.display_title,
      display_abstract: familyRow.display_abstract || "",
      company_key: familyRow.company_key,
      company_name: familyRow.company_display_name,
      priority_date: familyRow.priority_date || "",
      member_count: familyRow.member_count,
      jurisdiction_count: familyRow.jurisdiction_count,
      is_core_family: Boolean(familyRow.is_core_family),
      tags: (tagsRes.results || []).map((t) => t.tag),
      jurisdictions: jurRes.results || [],
      members: (pubsRes.results || []).map((p) => ({
        id: p.publication_number,
        authority: p.jurisdiction,
        title: p.title,
        abstract: p.abstract || "",
        assignee: p.assignee_display || familyRow.company_display_name,
        priority_date: p.priority_date || "",
        filing_date: p.filing_date || "",
        publication_date: p.publication_date || "",
        is_representative: Boolean(p.is_public_representative || p.is_technical_representative),
      })),
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch family detail from D1" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
