import { FullAnalyticsJSON, PatentFamilyIndexItem, PatentFamily, LandscapeData } from './types';

export async function fetchAnalytics(): Promise<FullAnalyticsJSON> {
  const response = await fetch('/data/analytics.json');
  if (!response.ok) throw new Error('Failed to fetch analytics data');
  return response.json();
}

export async function fetchFamiliesIndex(): Promise<PatentFamilyIndexItem[]> {
  const response = await fetch('/data/families/index.json');
  if (!response.ok) throw new Error('Failed to fetch families index');
  return response.json();
}

export async function fetchFamilyDetails(familyPublicId: string): Promise<PatentFamily> {
  // Map "FAM-001" or "DEMO-FAMILY-001" to "family-001"
  const fileId = familyPublicId.toLowerCase().replace('demo-family-', 'family-').replace('fam-', 'family-');
  const response = await fetch(`/data/families/${fileId}.json`);
  if (!response.ok) throw new Error(`Failed to fetch details for ${familyPublicId}`);
  return response.json();
}

export async function fetchTechnologyLandscape(): Promise<LandscapeData> {
  const response = await fetch('/data/technology-landscape.json');
  if (!response.ok) throw new Error('Failed to fetch technology landscape data');
  return response.json();
}
