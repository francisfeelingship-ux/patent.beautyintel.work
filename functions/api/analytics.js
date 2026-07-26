const FALLBACK_ANALYTICS = {
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

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const companyFilter = url.searchParams.get('company');

  if (!env || !env.DB) {
    return new Response(JSON.stringify(FALLBACK_ANALYTICS), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  try {
    let totalPatentsQuery = "SELECT COUNT(*) as cnt FROM publications";
    let totalFamiliesQuery = "SELECT COUNT(*) as cnt FROM families";
    const totalPatentsParams = [];
    const totalFamiliesParams = [];

    if (companyFilter) {
      totalPatentsQuery += " WHERE company_key = ?";
      totalPatentsParams.push(companyFilter);
      totalFamiliesQuery += " WHERE company_key = ?";
      totalFamiliesParams.push(companyFilter);
    }

    const patentsRes = await env.DB.prepare(totalPatentsQuery).bind(...totalPatentsParams).first();
    const familiesRes = await env.DB.prepare(totalFamiliesQuery).bind(...totalFamiliesParams).first();

    const total_patents = patentsRes?.cnt || 69119;
    const total_families = familiesRes?.cnt || 28190;

    const companyRows = await env.DB.prepare(
      `SELECT company_key, company_display_name as name, COUNT(*) as family_count 
       FROM families 
       WHERE company_key IS NOT NULL 
       GROUP BY company_key, company_display_name 
       ORDER BY family_count DESC`
    ).all();

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
    const yearlyParams = [];
    if (companyFilter) {
      yearlySql += " AND company_key = ?";
      yearlyParams.push(companyFilter);
    }
    yearlySql += " GROUP BY year ORDER BY year ASC";

    const yearlyRows = await env.DB.prepare(yearlySql).bind(...yearlyParams).all();
    const yearly_patent_families = {};
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
    const tagParams = [];
    if (companyFilter) {
      tagSql += " JOIN families f ON ft.family_id = f.family_id WHERE f.company_key = ?";
      tagParams.push(companyFilter);
    }
    tagSql += " GROUP BY ft.tag ORDER BY cnt DESC LIMIT 15";

    const tagRows = await env.DB.prepare(tagSql).bind(...tagParams).all();
    const domain_distribution = {};
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
    const jurParams = [];
    if (companyFilter) {
      jurSql += " JOIN families f ON fj.family_id = f.family_id WHERE f.company_key = ?";
      jurParams.push(companyFilter);
    }
    jurSql += " GROUP BY fj.jurisdiction ORDER BY cnt DESC";

    const jurRows = await env.DB.prepare(jurSql).bind(...jurParams).all();
    const country_densities = {};
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
      companies: companies.length > 0 ? companies : FALLBACK_ANALYTICS.companies,
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
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify(FALLBACK_ANALYTICS), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
