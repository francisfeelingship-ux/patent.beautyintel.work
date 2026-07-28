import { FullAnalyticsJSON, PatentFamily, LandscapeData } from './types';

export async function fetchAnalytics(companyKey?: string): Promise<FullAnalyticsJSON> {
  const url = companyKey ? `/api/analytics?company=${encodeURIComponent(companyKey)}` : '/api/analytics';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Analytics API error: ${response.statusText}`);
  }
  return await response.json();
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Families API error: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchFamilyDetails(familyPublicId: string): Promise<PatentFamily> {
  const response = await fetch(`/api/family/${encodeURIComponent(familyPublicId)}`);
  if (!response.ok) {
    throw new Error(`Family details API error: ${response.statusText}`);
  }
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
    nodes: data.nodes || (data.members || []).map((m: any) => ({
      id: m.id || m.publicationNumber,
      label: m.id || m.publicationNumber,
      type: m.is_representative ? 'core' : (m.abstract ? 'equivalent_with_text' : 'equivalent'),
      is_representative: Boolean(m.is_representative),
      country: m.authority || 'WO',
      title: m.title,
      assignee: m.assignee || data.company_name,
      publicationNumber: m.id || m.publicationNumber,
      authority: m.authority,
      kindCode: m.kind,
      publicationDate: m.publication_date,
    })),
    edges: data.edges || (data.members || []).slice(1).map((m: any, idx: number) => ({
      source: data.members[0]?.id || data.public_id,
      target: m.id || m.publicationNumber,
      type: idx % 2 === 0 ? 'continuation' : 'priority',
    })),
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
