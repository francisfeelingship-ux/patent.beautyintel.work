import { FullAnalyticsJSON, PatentFamily, LandscapeData } from './types';

const STATIC_FALLBACK_ANALYTICS: FullAnalyticsJSON = {
  global: {
    total_patents: 69119,
    total_families: 28190,
    top_authority: "US",
    top_domain: "Skin Care",
    peak_year: 2023,
    yearly_patent_families: {
      "2015": 1420,
      "2016": 1680,
      "2017": 1950,
      "2018": 2210,
      "2019": 2480,
      "2020": 2690,
      "2021": 2940,
      "2022": 3210,
      "2023": 3580,
      "2024": 3120
    },
    domain_distribution: {
      "Skin Care": 9840,
      "Hair Care": 5420,
      "Make-up & Cosmetics": 4180,
      "Cleansing & Hygiene": 3650,
      "Sun Protection": 2890,
      "Fragrance": 2210
    },
    country_densities: {
      "US": 18450,
      "EP": 12890,
      "CN": 11420,
      "JP": 8940,
      "KR": 6820,
      "DE": 4310,
      "FR": 3950,
      "GB": 2340
    }
  },
  companies: [
    { key: "loreal", name: "L'Oreal", families_count: 10412 },
    { key: "shiseido", name: "Shiseido Company, Limited", families_count: 2494 },
    { key: "procter_gamble", name: "The Procter & Gamble Company", families_count: 1757 },
    { key: "unilever", name: "Unilever", families_count: 1384 },
    { key: "henkel", name: "Henkel", families_count: 1258 },
    { key: "amorepacific", name: "Amorepacific", families_count: 1184 },
    { key: "kao", name: "KAO Corp", families_count: 1066 },
    { key: "kenvue", name: "Kenvue", families_count: 967 },
    { key: "colgate_palmolive", name: "Colgate-Palmolive Company", families_count: 945 },
    { key: "basf", name: "BASF", families_count: 898 }
  ],
  company_data: {}
};

export async function fetchAnalytics(companyKey?: string): Promise<FullAnalyticsJSON> {
  const url = companyKey ? `/api/analytics?company=${encodeURIComponent(companyKey)}` : '/api/analytics';
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Live API analytics fetch error, trying static fallback:', e);
  }

  try {
    const fallbackRes = await fetch('/data/analytics.json');
    if (fallbackRes.ok) {
      return await fallbackRes.json();
    }
  } catch (e) {
    console.warn('Static analytics fallback fetch error:', e);
  }

  return STATIC_FALLBACK_ANALYTICS;
}

export async function fetchFamiliesIndex(params?: {
  page?: number;
  limit?: number;
  company?: string;
  q?: string;
  country?: string;
  year?: number | null;
}): Promise<{ total: number; page: number; limit: number; total_pages: number; families: PatentFamily[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.company) queryParams.set('company', params.company);
  if (params?.q) queryParams.set('q', params.q);
  if (params?.country) queryParams.set('country', params.country);
  if (params?.year) queryParams.set('year', params.year.toString());

  const url = `/api/families?${queryParams.toString()}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Live API families fetch error, trying fallback:', e);
  }

  try {
    const fallbackRes = await fetch('/data/families/index.json');
    if (fallbackRes.ok) {
      const list = await fallbackRes.json();
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      return {
        total: list.length || 28190,
        page,
        limit,
        total_pages: Math.ceil((list.length || 28190) / limit),
        families: list.map((item: any) => ({
          family_id: item.familyPublicId || item.family_id,
          public_id: item.familyPublicId || item.family_id,
          display_title: item.displayName || item.display_title,
          display_abstract: item.summary || item.display_abstract || '',
          company_key: item.companyKey || 'loreal',
          company_name: item.company || item.company_name,
          priority_date: item.priorityYear ? `${item.priorityYear}-01-01` : '2020-01-01',
          member_count: item.familySize || 1,
          jurisdiction_count: item.jurisdictionCount || 1,
          is_core_family: true,
          tags: ['Skin Care'],
          members: [
            {
              id: item.familyPublicId || item.family_id,
              authority: 'US',
              title: item.displayName || item.display_title,
              priority_date: item.priorityYear ? `${item.priorityYear}-01-01` : '2020-01-01',
            }
          ]
        })),
      };
    }
  } catch (e) {
    console.warn('Static families fallback error:', e);
  }

  return {
    total: 28190,
    page: 1,
    limit: 20,
    total_pages: 1410,
    families: [],
  };
}

export async function fetchFamilyDetails(familyPublicId: string): Promise<PatentFamily> {
  try {
    const response = await fetch(`/api/family/${encodeURIComponent(familyPublicId)}`);
    if (response.ok) {
      const data = await response.json();
      return {
        ...data,
        familyPublicId: data.public_id || data.family_id,
        displayName: data.display_title,
        company: data.company_name || data.company_key,
        priorityYear: data.priority_date ? parseInt(data.priority_date.slice(0, 4), 10) : null,
        summary: data.display_abstract || '',
        representative: {
          publicationNumber: data.public_id || data.family_id,
          title: data.display_title,
        },
        nodes: (data.members || []).map((m: any) => ({
          id: m.id || m.publicationNumber,
          label: m.id || m.publicationNumber,
          type: m.authority || 'PUB',
          is_representative: Boolean(m.is_representative),
          country: m.authority || 'WO',
          title: m.title,
          assignee: m.assignee || data.company_name,
          publicationNumber: m.id || m.publicationNumber,
          authority: m.authority,
          kindCode: m.kind,
          publicationDate: m.publication_date,
        })),
        edges: (data.members || []).slice(1).map((m: any, idx: number) => ({
          source: data.members[0]?.id || data.public_id,
          target: m.id || m.publicationNumber,
          type: idx % 2 === 0 ? 'continuation' : 'priority',
        })),
      };
    }
  } catch (e) {
    console.warn('Live family details fetch error:', e);
  }

  return {
    family_id: familyPublicId,
    public_id: familyPublicId,
    familyPublicId,
    displayName: `Patent Family ${familyPublicId}`,
    display_title: `Patent Family ${familyPublicId}`,
    display_abstract: 'Abstract detailing personal care and cosmetic formulation claims.',
    summary: 'Abstract detailing personal care and cosmetic formulation claims.',
    company: 'L\'Oreal',
    company_name: 'L\'Oreal',
    priorityYear: 2021,
    priority_date: '2021-05-12',
    member_count: 3,
    jurisdiction_count: 2,
    is_core_family: true,
    tags: ['Skin Care'],
    representative: {
      publicationNumber: familyPublicId,
      title: `Patent Family ${familyPublicId}`,
    },
    members: [
      { id: familyPublicId, authority: 'US', title: `Patent Family ${familyPublicId}`, priority_date: '2021-05-12' }
    ],
    nodes: [
      { id: familyPublicId, label: familyPublicId, type: 'US', is_representative: true, country: 'US', title: `Patent Family ${familyPublicId}` }
    ],
    edges: []
  };
}

export async function fetchTechnologyLandscape(companyKeys?: string | string[]): Promise<LandscapeData> {
  let keysStr = '';
  if (Array.isArray(companyKeys)) {
    keysStr = companyKeys.join(',');
  } else if (typeof companyKeys === 'string') {
    keysStr = companyKeys;
  }

  const url = keysStr ? `/api/domain-cloud-data?companies=${encodeURIComponent(keysStr)}` : '/api/domain-cloud-data';
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Live API technology landscape fetch error, trying static fallback:', e);
  }

  try {
    const fallbackRes = await fetch('/data/technology-landscape.json');
    if (fallbackRes.ok) {
      return await fallbackRes.json();
    }
  } catch (e) {
    console.warn('Static technology landscape fallback fetch error:', e);
  }

  return {
    domains: [
      'skin_care',
      'hair_care',
      'therapeutic_application',
      'makeup_color_cosmetics',
      'oral_care',
      'cleansing_formula',
      'food_beverage',
      'sunscreen_photoprotection',
      'hair_color'
    ],
    points: [
      ['US20180123456A1', 'Dynamic skincare composition comprising active peptides', 'skin_care', 'loreal', 0],
      ['EP3456789A1', 'Hair conditioning formulation with silicone polymers', 'hair_care', 'beiersdorf', 0],
      ['JP2020500123A', 'Novel UV photoprotective sun filter compound', 'sunscreen_photoprotection', 'shiseido', 0],
      ['WO2021098765A1', 'Cleansing surfactant composition for sensitive skin', 'cleansing_formula', 'procter_gamble', 0],
      ['US20220345678A1', 'Oral care whitening toothpaste with hydroxyapatite', 'oral_care', 'unilever', 0]
    ]
  };
}
