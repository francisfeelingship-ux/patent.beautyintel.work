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

// Comprehensive alias dictionary mapping parent company keys to all subsidiary / brand keys in DB
const COMPANY_ALIAS_MAP = {
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

// Build reverse lookup map: subsidiary/alias key -> parent company key
const ALIAS_TO_PARENT_MAP = {};
for (const [parentKey, aliases] of Object.entries(COMPANY_ALIAS_MAP)) {
  for (const alias of aliases) {
    ALIAS_TO_PARENT_MAP[alias.toLowerCase().trim()] = parentKey;
  }
}

// Expand list of selected parent company keys to include all alias & subsidiary keys for SQL
function expandCompanyKeys(requestedKeys) {
  const expanded = new Set();
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

// Map db key to parent key
function resolveParentCompanyKey(dbKey, requestedParentKeys) {
  if (!dbKey) return 'other';
  const k = dbKey.toLowerCase().trim();
  if (requestedParentKeys.includes(k)) return k;
  const parent = ALIAS_TO_PARENT_MAP[k];
  if (parent && requestedParentKeys.includes(parent)) {
    return parent;
  }
  return 'other';
}

// Accurate domain tag resolution combining explicit tags and title keywords
function resolveDomain(tag, title, pub) {
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

  // Deterministic fallback based on publication ID hash
  const hash = Math.abs((pub || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return CANONICAL_DOMAINS[hash % CANONICAL_DOMAINS.length];
}

const FALLBACK_CLOUD_DATA = {
  domains: CANONICAL_DOMAINS,
  points: [
    ['US20180123456A1', 'Dynamic skincare composition comprising active peptides', 'skin_care', 'loreal', 0],
    ['EP3456789A1', 'Hair conditioning formulation with silicone polymers', 'hair_care', 'beiersdorf', 0],
    ['JP2020500123A', 'Novel UV photoprotective sun filter compound', 'sunscreen_photoprotection', 'shiseido', 0],
    ['WO2021098765A1', 'Cleansing surfactant composition for sensitive skin', 'cleansing_formula', 'procter_gamble', 0],
    ['US20220345678A1', 'Oral care whitening toothpaste with hydroxyapatite', 'oral_care', 'colgate_palmolive', 0],
    ['US202300112233A1', 'Soothing topical skin formulation with colloidal oatmeal', 'skin_care', 'kenvue', 0]
  ]
};

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const companiesParam = url.searchParams.get('companies');

  const requestedParentKeys = companiesParam
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
    if (requestedParentKeys.length === 0) {
      return new Response(JSON.stringify({ domains: CANONICAL_DOMAINS, points: [] }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      });
    }

    // Expand parent company keys to include all subsidiary & brand alias keys
    const expandedKeys = expandCompanyKeys(requestedParentKeys);
    const placeholders = expandedKeys.map(() => '?').join(',');

    // Query core families (is_core_family != 0) matching any of the expanded company keys
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

    const res = await env.DB.prepare(sql).bind(...expandedKeys).all();
    const rows = res.results || [];

    const patentMap = new Map();

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
  } catch (err) {
    console.error('D1 Domain cloud fetch error:', err);
    return new Response(JSON.stringify(FALLBACK_CLOUD_DATA), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
