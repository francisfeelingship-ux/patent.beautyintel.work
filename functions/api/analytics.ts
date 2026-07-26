/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const companyFilter = url.searchParams.get('company');

  try {
    let totalPatentsQuery = "SELECT COUNT(*) as cnt FROM publications";
    let totalFamiliesQuery = "SELECT COUNT(*) as cnt FROM families";
    const totalPatentsParams: any[] = [];
    const totalFamiliesParams: any[] = [];

    if (companyFilter) {
      totalPatentsQuery += " WHERE company_key = ?";
      totalPatentsParams.push(companyFilter);
      totalFamiliesQuery += " WHERE company_key = ?";
      totalFamiliesParams.push(companyFilter);
    }

    const patentsRes = await env.DB.prepare(totalPatentsQuery).bind(...totalPatentsParams).first<{ cnt: number }>();
    const familiesRes = await env.DB.prepare(totalFamiliesQuery).bind(...totalFamiliesParams).first<{ cnt: number }>();

    const total_patents = patentsRes?.cnt || 0;
    const total_families = familiesRes?.cnt || 0;

    const companyRows = await env.DB.prepare(
      `SELECT company_key, company_display_name as name, COUNT(*) as family_count 
       FROM families 
       WHERE company_key IS NOT NULL 
       GROUP BY company_key, company_display_name 
       ORDER BY family_count DESC`
    ).all<{ company_key: string; name: string; family_count: number }>();

    const companies = (companyRows.results || []).map((c) => ({
      key: c.company_key,
      name: c.name,
      families_count: c.family_count,
    }));

    let yearlySql = `
      SELECT strftime('%Y', priority_date) as year, COUNT(*) as cnt 
      FROM families 
      WHERE priority_date IS NOT NULL AND strftime('%Y', priority_date) >= '1990'
    `;
    const yearlyParams: any[] = [];
    if (companyFilter) {
      yearlySql += " AND company_key = ?";
      yearlyParams.push(companyFilter);
    }
    yearlySql += " GROUP BY year ORDER BY year ASC";

    const yearlyRows = await env.DB.prepare(yearlySql).bind(...yearlyParams).all<{ year: string; cnt: number }>();
    const yearly_patent_families: Record<string, number> = {};
    let peak_year = 2023;
    let maxYearCnt = 0;

    (yearlyRows.results || []).forEach((row) => {
      if (row.year) {
        const yr = parseInt(row.year, 10);
        yearly_patent_families[row.year] = row.cnt;
        if (row.cnt > maxYearCnt) {
          maxYearCnt = row.cnt;
          peak_year = yr;
        }
      }
    });

    let tagSql = `
      SELECT ft.tag, COUNT(*) as cnt 
      FROM family_tags ft
    `;
    const tagParams: any[] = [];
    if (companyFilter) {
      tagSql += " JOIN families f ON ft.family_id = f.family_id WHERE f.company_key = ?";
      tagParams.push(companyFilter);
    }
    tagSql += " GROUP BY ft.tag ORDER BY cnt DESC LIMIT 15";

    const tagRows = await env.DB.prepare(tagSql).bind(...tagParams).all<{ tag: string; cnt: number }>();
    const domain_distribution: Record<string, number> = {};
    let top_domain = "Skin Care";
    let maxDomainCnt = 0;

    (tagRows.results || []).forEach((row) => {
      domain_distribution[row.tag] = row.cnt;
      if (row.cnt > maxDomainCnt) {
        maxDomainCnt = row.cnt;
        top_domain = row.tag;
      }
    });

    let jurSql = `
      SELECT fj.jurisdiction, SUM(fj.publication_count) as cnt 
      FROM family_jurisdictions fj
    `;
    const jurParams: any[] = [];
    if (companyFilter) {
      jurSql += " JOIN families f ON fj.family_id = f.family_id WHERE f.company_key = ?";
      jurParams.push(companyFilter);
    }
    jurSql += " GROUP BY fj.jurisdiction ORDER BY cnt DESC";

    const jurRows = await env.DB.prepare(jurSql).bind(...jurParams).all<{ jurisdiction: string; cnt: number }>();
    const country_densities: Record<string, number> = {};
    let top_authority = "US";
    let maxJurCnt = 0;

    (jurRows.results || []).forEach((row) => {
      country_densities[row.jurisdiction] = row.cnt;
      if (row.cnt > maxJurCnt && !["WO", "EP", "IB"].includes(row.jurisdiction)) {
        maxJurCnt = row.cnt;
        top_authority = row.jurisdiction;
      }
    });

    const responsePayload = {
      global: {
        total_patents,
        total_families,
        top_authority,
        top_domain,
        peak_year,
        yearly_patent_families,
        domain_distribution,
        country_densities,
      },
      companies,
      company_data: companyFilter
        ? {
            [companyFilter]: {
              total_patents,
              total_families,
              top_authority,
              top_domain,
              peak_year,
              yearly_patent_families,
              domain_distribution,
              country_densities,
            },
          }
        : {},
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch analytics from D1" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
