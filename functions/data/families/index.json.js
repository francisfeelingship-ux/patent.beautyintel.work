export async function onRequest(context) {
  const { onRequest: handleFamilies } = await import('../../api/families.js');
  const res = await handleFamilies(context);
  if (!res.ok) return res;
  const data = await res.json();
  // Format for legacy fetchFamiliesIndex callers expecting an array
  const legacyList = (data.families || []).map((f) => ({
    familyPublicId: f.public_id || f.family_id,
    displayName: f.display_title,
    company: f.company_name,
    priorityYear: f.priority_date ? parseInt(f.priority_date.slice(0, 4), 10) : null,
    familySize: f.member_count,
    jurisdictionCount: f.jurisdiction_count,
    representative: {
      publicationNumber: f.public_id || f.family_id,
      title: f.display_title,
    },
  }));
  return new Response(JSON.stringify(legacyList), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
