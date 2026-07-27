export async function onRequest(context) {
  const { env, params } = context;
  const familyIdOrPublicId = params.id;

  if (!familyIdOrPublicId) {
    return new Response(JSON.stringify({ error: "Missing family ID" }), { status: 400 });
  }

  if (!env || !env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' unavailable" }), { status: 500 });
  }

  try {
    let familyRow = await env.DB.prepare(
      `SELECT * FROM families WHERE family_id = ? OR public_representative_publication = ? LIMIT 1`
    ).bind(familyIdOrPublicId, familyIdOrPublicId).first();

    let pubRow = null;
    if (!familyRow) {
      pubRow = await env.DB.prepare(
        `SELECT * FROM publications WHERE publication_number = ? OR publication_id = ? LIMIT 1`
      ).bind(familyIdOrPublicId, familyIdOrPublicId).first();

      if (pubRow && pubRow.family_id) {
        familyRow = await env.DB.prepare(
          `SELECT * FROM families WHERE family_id = ? LIMIT 1`
        ).bind(pubRow.family_id).first();
      }
    }

    if (familyRow) {
      const family_id = familyRow.family_id;

      const pubsRes = await env.DB.prepare(
        `SELECT * FROM publications WHERE family_id = ? ORDER BY publication_date DESC`
      ).bind(family_id).all();

      const tagsRes = await env.DB.prepare(
        `SELECT tag FROM family_tags WHERE family_id = ?`
      ).bind(family_id).all();

      const jurRes = await env.DB.prepare(
        `SELECT jurisdiction, publication_count FROM family_jurisdictions WHERE family_id = ?`
      ).bind(family_id).all();

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
        members: memberRows.map((p) => ({
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
  } catch (err) {
    console.error("D1 family detail query error:", err);
    return new Response(JSON.stringify({ error: err.message || "Database query error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
