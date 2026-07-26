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
  yearly_patent_families?: Record<string, number>;
  domain_distribution?: Record<string, number>;
  country_densities: Record<string, number>;
}

export interface FullAnalyticsJSON {
  companies: Company[];
  global: AnalyticsData;
  company_data: Record<string, AnalyticsData>;
}

export interface PatentFamilyIndexItem {
  familyPublicId: string;
  family_id?: string;
  public_id?: string;
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
  id?: string;
  authority?: string;
  title: string;
  jurisdiction?: string;
  kind?: string;
  type?: string;
  priority_date?: string;
  publication_date?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  is_representative: boolean;
  country: string;
  title: string;
  assignee: string;
  publicationNumber?: string;
  authority?: string;
  kindCode?: string;
  publicationDate?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface PatentFamily {
  familyPublicId: string;
  family_id?: string;
  public_id?: string;
  displayName: string;
  display_title?: string;
  company: string;
  company_name?: string;
  priorityYear: number | null;
  priority_date?: string;
  summary: string;
  display_abstract?: string;
  representative: {
    publicationNumber: string;
    title: string;
  };
  jurisdictions: string[] | Array<{ jurisdiction: string; publication_count: number }>;
  members: FamilyMember[];
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export interface LandscapeData {
  domains: string[];
  points: any[];
}
