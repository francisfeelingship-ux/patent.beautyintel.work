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

// Helper to map DB tag strings to canonical tag keys
function mapToCanonicalDomain(tag) {
  if (!tag) return 'skin_care';
  const t = tag.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (t.includes('skin')) return 'skin_care';
  if (t.includes('hair_color') || t.includes('dye') || t.includes('coloration')) return 'hair_color';
  if (t.includes('hair')) return 'hair_care';
  if (t.includes('therapeutic') || t.includes('pharma') || t.includes('medical') || t.includes('treatment')) return 'therapeutic_application';
  if (t.includes('makeup') || t.includes('cosmetic') || t.includes('color') || t.includes('lipstick')) return 'makeup_color_cosmetics';
  if (t.includes('oral') || t.includes('teeth') || t.includes('toothpaste')) return 'oral_care';
  if (t.includes('cleans') || t.includes('wash') || t.includes('soap') || t.includes('hygiene')) return 'cleansing_formula';
  if (t.includes('food') || t.includes('beverage') || t.includes('drink') || t.includes('nutrition')) return 'food_beverage';
  if (t.includes('sun') || t.includes('photo') || t.includes('uv') || t.includes('photoprotect')) return 'sunscreen_photoprotection';
  
  return CANONICAL_DOMAINS[Math.abs(t.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % CANONICAL_DOMAINS.length];
}

const FALLBACK_CLOUD_DATA = {
  domains: CANONICAL_DOMAINS,
  points: [
    ['US20180123456A1', 'Dynamic skincare composition comprising active peptides', 'skin_care', 'loreal', 0],
    ['EP3456789A1', 'Hair conditioning formulation with silicone polymers', 'hair_care', 'beiersdorf', 0],
    ['JP2020500123A', 'Novel UV photoprotective sun filter compound', 'sunscreen_photoprotection', 'shiseido', 0],
    ['WO2021098765A1', 'Cleansing surfactant composition for sensitive skin', 'cleansing_formula', 'procter_gamble', 0],
    ['US20220345678A1', 'Oral care whitening toothpaste with hydroxyapatite', 'oral_care', 'unilever', 0]
  ]
};

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const companiesParam = url.searchParams.get('companies');

  const selectedCompanies = companiesParam
    ? companiesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  if (!env || !env.DB) {
    return new Response(JSON.stringify(FALLBACK_CLOUD_DATA), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  try {
    if (selectedCompanies.length === 0) {
      return new Response(JSON.stringify({ domains: CANONICAL_DOMAINS, points: [] }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      });
    }

    const placeholders = selectedCompanies.map(() => '?').join(',');
    
    // Fetch core patent families (is_core_family = 1) for the requested companies
    const sql = `
      SELECT DISTINCT 
        COALESCE(f.public_representative_publication, f.family_id) as pub,
        f.display_title as title,
        ft.tag as domain_tag,
        f.company_key
      FROM families f
      LEFT JOIN family_tags ft ON f.family_id = ft.family_id
      WHERE (f.is_core_family = 1 OR f.is_core_family IS NULL)
        AND LOWER(f.company_key) IN (${placeholders})
      LIMIT 10000
    `;

    const res = await env.DB.prepare(sql).bind(...selectedCompanies).all();
    const rows = res.results || [];

    const patentMap = new Map();

    for (const r of rows) {
      const pub = r.pub || 'US20200000000A1';
      const title = r.title || 'Patent Inventions';
      const company_key = (r.company_key || 'loreal').toLowerCase();
      const domain = mapToCanonicalDomain(r.domain_tag);

      if (!patentMap.has(pub)) {
        patentMap.set(pub, {
          pub,
          title,
          domain,
          company_key,
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
  } catch (err) {
    console.error('D1 Domain cloud fetch error:', err);
    return new Response(JSON.stringify(FALLBACK_CLOUD_DATA), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
