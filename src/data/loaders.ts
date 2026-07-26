import { FullAnalyticsJSON, PatentFamily, LandscapeData } from './types';

export async function fetchAnalytics(companyKey?: string): Promise<FullAnalyticsJSON> {
  const url = companyKey ? `/api/analytics?company=${encodeURIComponent(companyKey)}` : '/api/analytics';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch analytics from live D1 database (${response.status})`);
  }
  return response.json();
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
    throw new Error(`Failed to fetch families from live D1 database (${response.status})`);
  }
  return response.json();
}

export async function fetchFamilyDetails(familyPublicId: string): Promise<PatentFamily> {
  const response = await fetch(`/api/family/${encodeURIComponent(familyPublicId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch details for family ${familyPublicId} from live D1 database (${response.status})`);
  }
  const data = await response.json();
  
  // Format for React components expecting legacy fields alongside D1 fields
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

export async function fetchTechnologyLandscape(companyKey?: string): Promise<LandscapeData> {
  const url = companyKey ? `/api/analytics?company=${encodeURIComponent(companyKey)}` : '/api/analytics';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch landscape data from live D1 database (${response.status})`);
  }
  const data = await response.json();
  
  const points = Object.entries(data.global?.domain_distribution || {}).map(([tag, count], index) => ([
    `pt-${index}`,
    tag,
    'Skin Care',
    'L\'Oreal',
    count as number
  ]));

  return { domains: Object.keys(data.global?.domain_distribution || {}), points };
}
