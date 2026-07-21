export interface Company {
  key: string;
  name: string;
}

export interface AnalyticsData {
  total_patents: number;
  total_families: number;
  top_authority: string;
  top_domain: string;
  peak_year: number;
  domains: Array<{ domain: string; count: number }>;
  yearly_filings: Array<{ year: number; count: number }>;
  country_densities: Record<string, number>;
}

export interface FullAnalyticsJSON {
  companies: Company[];
  global: AnalyticsData;
  company_data: Record<string, AnalyticsData>;
}

export interface PatentFamilyIndexItem {
  familyPublicId: string;
  displayName: string;
  company: string;
  priorityYear: number | null;
  familySize: number;
  jurisdictionCount: number;
  representative: {
    publicationNumber: string;
    title: string;
  };
}

export interface FamilyMember {
  publicationNumber: string;
  title: string;
  jurisdiction: string;
  kind: string;
  type: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  is_representative: boolean;
  country: string;
  title: string;
  assignee: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface PatentFamily {
  familyPublicId: string;
  displayName: string;
  company: string;
  priorityYear: number | null;
  summary: string;
  representative: {
    publicationNumber: string;
    title: string;
  };
  jurisdictions: string[];
  members: FamilyMember[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LandscapeData {
  domains: string[];
  points: Array<[string, string, string, string, number]>;
}
