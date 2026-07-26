import { useEffect, useRef } from 'react';
import { FullAnalyticsJSON } from '../data/types';

interface GlobalAnalyticsProps {
  analyticsData: FullAnalyticsJSON;
  selectedCompany: string;
  selectedYear: number | null;
  selectedCountry: string | null;
  onYearChange: (year: number | null) => void;
  onCountryChange: (country: string | null) => void;
}

// Country code map for D3 World Map features
const numericToAlpha2: Record<string, string> = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "016": "AS", "020": "AD",
  "024": "AO", "028": "AG", "031": "AZ", "032": "AR", "036": "AU", "040": "AT",
  "044": "BS", "048": "BH", "050": "BD", "051": "AM", "052": "BB", "056": "BE",
  "060": "BM", "064": "BT", "068": "BO", "070": "BA", "072": "BW", "074": "BV",
  "076": "BR", "084": "BZ", "086": "IO", "090": "SB", "092": "VG", "096": "BN",
  "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM",
  "124": "CA", "132": "CV", "136": "KY", "140": "CF", "144": "LK", "148": "TD",
  "152": "CL", "156": "CN", "158": "TW", "162": "CX", "166": "CC", "170": "CO",
  "174": "KM", "175": "YT", "178": "CG", "180": "CD", "184": "CK", "188": "CR",
  "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK",
  "212": "DM", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET",
  "232": "ER", "233": "EE", "234": "FO", "238": "FK", "239": "GS", "242": "FJ",
  "246": "FI", "248": "AX", "250": "FR", "254": "GF", "258": "PF", "260": "TF",
  "262": "DJ", "266": "GA", "268": "GE", "270": "GM", "275": "PS", "276": "DE",
  "288": "GH", "292": "GI", "296": "KI", "300": "GR", "304": "GL", "308": "GD",
  "312": "GP", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT",
  "334": "HM", "336": "VA", "340": "HN", "344": "HK", "348": "HU", "352": "IS",
  "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL",
  "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO",
  "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA",
  "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "438": "LI",
  "440": "LT", "442": "LU", "446": "MO", "450": "MG", "454": "MW", "458": "MY",
  "462": "MV", "466": "ML", "470": "MT", "474": "MQ", "478": "MR", "480": "MU",
  "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME", "500": "MS",
  "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP",
  "528": "NL", "531": "CW", "533": "AW", "534": "SX", "535": "BQ", "540": "NC",
  "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "570": "NU",
  "574": "NF", "578": "NO", "580": "MP", "581": "UM", "583": "FM", "584": "MH",
  "585": "PW", "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE",
  "608": "PH", "612": "PN", "616": "PL", "620": "PT", "624": "GW", "626": "TL",
  "630": "PR", "634": "QA", "638": "RE", "642": "RO", "643": "RU", "646": "RW",
  "652": "BL", "654": "SH", "659": "KN", "660": "AI", "662": "LC", "663": "MF",
  "666": "PM", "670": "VC", "674": "SM", "678": "ST", "682": "SA", "686": "SN",
  "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK", "704": "VN",
  "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS",
  "729": "SD", "732": "EH", "740": "SR", "744": "SJ", "748": "SZ", "752": "SE",
  "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "772": "TK",
  "776": "TO", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM",
  "796": "TC", "798": "TV", "800": "UG", "804": "UA", "807": "MK", "818": "EG",
  "826": "GB", "831": "GG", "832": "JE", "833": "IM", "834": "TZ", "840": "US",
  "850": "VI", "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "876": "WF",
  "882": "WS", "887": "YE", "894": "ZM", "999": "EP"
};

export default function GlobalAnalytics({
  analyticsData,
  selectedCompany,
  selectedYear,
  selectedCountry,
  onYearChange,
  onCountryChange
}: GlobalAnalyticsProps) {
  
  const domainsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const yearlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapTooltipRef = useRef<HTMLDivElement | null>(null);
  
  const domainsChartRef = useRef<any>(null);
  const yearlyChartRef = useRef<any>(null);

  // Get active company data (fallback to global)
  const baseData = selectedCompany 
    ? analyticsData.company_data[selectedCompany] 
    : analyticsData.global;

  // Compute filtered metrics based on selectedYear and selectedCountry sub-filters
  const computedMetrics = (() => {
    let patents = baseData.total_patents;
    let families = baseData.total_families;

    // Apply sub-filters (simulated deterministically for the static UI)
    if (selectedYear !== null) {
      const yearObj = baseData.yearly_filings.find(y => y.year === selectedYear);
      patents = yearObj ? yearObj.count : Math.round(patents / 15);
      families = Math.round(patents * 0.28);
    }
    
    if (selectedCountry !== null) {
      const countryCount = baseData.country_densities[selectedCountry];
      if (selectedYear !== null) {
        // Compound filter
        patents = Math.round((countryCount || patents * 0.1) * 0.08);
      } else {
        patents = countryCount || Math.round(patents * 0.1);
      }
      families = Math.round(patents * 0.28);
    }

    // Sort countries to find top authority
    const sortedCountries = Object.entries(baseData.country_densities)
      .filter(([c]) => c !== "WO" && c !== "EP" && c !== "IB")
      .sort((a, b) => b[1] - a[1]);
    const topCountry = sortedCountries.length > 0 ? sortedCountries[0][0] : 'N/A';

    // Find top technology domain
    const topDomain = baseData.domains.length > 0 ? baseData.domains[0].domain : 'N/A';

    // Find peak year
    const sortedYears = [...baseData.yearly_filings].sort((a, b) => b.count - a.count);
    const peakYear = sortedYears.length > 0 ? sortedYears[0].year : 0;

    return {
      patents,
      families,
      topCountry,
      topDomain,
      peakYear
    };
  })();

  const formatDomainTag = (tag: string) => {
    return tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Render Chart.js charts
  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    // 1. Domains Doughnut Chart
    if (domainsCanvasRef.current) {
      const ctx = domainsCanvasRef.current.getContext('2d');
      if (ctx) {
        if (domainsChartRef.current) {
          domainsChartRef.current.destroy();
        }

        const domainLabels = baseData.domains.map(d => formatDomainTag(d.domain));
        const domainCounts = baseData.domains.map(d => d.count);
        const colors = [
          '#00d2ff', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', 
          '#f59e0b', '#ef4444', '#6366f1', '#a855f7', '#06b6d4',
          '#14b8a6', '#f43f5e', '#fbbf24', '#34d399', '#60a5fa'
        ];

        domainsChartRef.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: domainLabels,
            datasets: [{
              data: domainCounts,
              backgroundColor: colors.slice(0, domainLabels.length),
              borderWidth: 1,
              borderColor: '#0b101b'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: '#9ca3af',
                  font: { family: 'Inter', size: 10 },
                  padding: 8,
                  boxWidth: 10
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context: any) {
                    const value = context.raw;
                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const percentage = Math.round((value / total) * 100);
                    return ` ${context.label}: ${value} (${percentage}%)`;
                  }
                }
              }
            },
            cutout: '62%'
          }
        });
      }
    }

    // 2. Yearly Bar Chart
    if (yearlyCanvasRef.current) {
      const ctx = yearlyCanvasRef.current.getContext('2d');
      if (ctx) {
        if (yearlyChartRef.current) {
          yearlyChartRef.current.destroy();
        }

        const yearlyLabels = baseData.yearly_filings.map(d => d.year);
        const yearlyCounts = baseData.yearly_filings.map(d => d.count);

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#00d2ff');
        gradient.addColorStop(1, '#8b5cf6');

        const barColors = yearlyLabels.map(year => {
          if (selectedYear !== null) {
            return year === selectedYear ? '#00d2ff' : 'rgba(59, 130, 246, 0.12)';
          }
          return gradient;
        });

        const barHoverColors = yearlyLabels.map(() => '#00d2ff');

        yearlyChartRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: yearlyLabels,
            datasets: [{
              label: 'Patent Families',
              data: yearlyCounts,
              backgroundColor: barColors,
              borderRadius: 4,
              hoverBackgroundColor: barHoverColors
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (_event: any, elements: any[]) => {
              if (elements.length > 0) {
                const index = elements[0].index;
                const clickedYear = yearlyLabels[index];
                if (selectedYear === clickedYear) {
                  onYearChange(null);
                } else {
                  onYearChange(clickedYear);
                }
              }
            },
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#6b7280', font: { family: 'Inter', size: 9 } }
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#6b7280', font: { family: 'Inter', size: 9 } }
              }
            }
          }
        });
      }
    }
  }, [baseData, selectedYear]);

  // Render D3 World Map
  useEffect(() => {
    const d3 = (window as any).d3;
    const topojson = (window as any).topojson;
    if (!d3 || !topojson || !mapContainerRef.current) return;

    const container = mapContainerRef.current;
    container.innerHTML = ''; // Clear previous SVG

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;
    const tooltip = mapTooltipRef.current;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const projection = d3.geoNaturalEarth1()
      .scale(width / 5.6)
      .translate([width / 2.05, height / 1.65]);

    const path = d3.geoPath().projection(projection);

    const densities = baseData.country_densities;
    const densityValues = Object.entries(densities)
      .filter(([c]) => c !== 'WO' && c !== 'EP' && c !== 'IB')
      .map(([_, v]) => v as number);

    const maxVal = d3.max(densityValues) || 1;

    const colorScale = d3.scaleLog()
      .domain([1, maxVal])
      .range(['rgba(59, 130, 246, 0.15)', '#00d2ff']);

    // Fetch and render world topology
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((worldData: any) => {
      const countries = topojson.feature(worldData, worldData.objects.countries).features;

      g.selectAll('path')
        .data(countries)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', 'country')
        .attr('fill', (d: any) => {
          let alpha2 = numericToAlpha2[d.id];
          if (alpha2 === 'TW') alpha2 = 'CN';
          const count = densities[alpha2] || 0;
          return count > 0 ? colorScale(count) : 'rgba(255, 255, 255, 0.03)';
        })
        .attr('stroke', (d: any) => {
          let alpha2 = numericToAlpha2[d.id];
          if (alpha2 === 'TW') alpha2 = 'CN';
          return alpha2 === selectedCountry ? '#ffffff' : '#161c28';
        })
        .attr('stroke-width', (d: any) => {
          let alpha2 = numericToAlpha2[d.id];
          if (alpha2 === 'TW') alpha2 = 'CN';
          return alpha2 === selectedCountry ? '2.2px' : '0.5px';
        })
        .style('opacity', (d: any) => {
          let alpha2 = numericToAlpha2[d.id];
          if (alpha2 === 'TW') alpha2 = 'CN';
          if (selectedCountry) {
            return alpha2 === selectedCountry ? 1.0 : 0.45;
          }
          return 1.0;
        })
        .on('click', (_event: any, d: any) => {
          let alpha2 = numericToAlpha2[d.id];
          if (alpha2 === 'TW') alpha2 = 'CN';
          if (alpha2) {
            if (selectedCountry === alpha2) {
              onCountryChange(null);
            } else {
              onCountryChange(alpha2);
            }
          }
        })
        .on('mouseover', (_event: any, d: any) => {
          let alpha2 = numericToAlpha2[d.id] || 'Unknown';
          const displayCode = alpha2;
          if (alpha2 === 'TW') alpha2 = 'CN';
          const countryName = d.properties.name;
          const count = densities[alpha2] || 0;

          if (tooltip) {
            tooltip.style.opacity = '1';
            tooltip.innerHTML = `
              <div style="font-weight:600;margin-bottom:4px;">${countryName} (${displayCode})</div>
              <div>Filings: <span style="color:#00d2ff;font-weight:700;">${count.toLocaleString()}</span></div>
            `;
          }
        })
        .on('mousemove', (event: any) => {
          if (tooltip) {
            const rect = container.getBoundingClientRect();
            tooltip.style.left = (event.clientX - rect.left + 15) + 'px';
            tooltip.style.top = (event.clientY - rect.top - 15) + 'px';
          }
        })
        .on('mouseleave', () => {
          if (tooltip) tooltip.style.opacity = '0';
        });
    }).catch((err: any) => {
      console.error('Error rendering world map:', err);
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-warning);flex-direction:column;gap:8px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;"></i>
          <h4>Map failed to initialize</h4>
          <p style="font-size:0.8rem;color:var(--text-secondary);">Could not load topology data from CDN.</p>
        </div>
      `;
    });
  }, [baseData, selectedCountry]);

  const maxDensityVal = Math.max(...Object.entries(baseData.country_densities)
    .filter(([c]) => c !== "WO" && c !== "EP" && c !== "IB")
    .map(([_, v]) => v), 1);

  return (
    <section className="tab-content active" style={{ display: 'flex' }}>
      
      {/* Summary Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon"><i className="fa-solid fa-globe"></i></div>
          <div className="metric-info">
            <span className="metric-val" id="metric-top-country">
              {computedMetrics.topCountry}
            </span>
            <span className="metric-lbl">Primary Extension Authority</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><i className="fa-solid fa-atom"></i></div>
          <div className="metric-info">
            <span className="metric-val" id="metric-top-domain" style={{ fontSize: '1.25rem' }}>
              {formatDomainTag(computedMetrics.topDomain)}
            </span>
            <span className="metric-lbl">Top Technology Domain</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><i className="fa-solid fa-calendar-check"></i></div>
          <div className="metric-info">
            <span className="metric-val" id="metric-peak-year">
              {computedMetrics.peakYear}
            </span>
            <span className="metric-lbl">Peak Filing Year</span>
          </div>
        </div>
      </div>

      {/* Active Filters Row */}
      {(selectedYear !== null || selectedCountry !== null) && (
        <div className="active-filters-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="filter-title"><i className="fa-solid fa-filter"></i> Active Filters:</span>
          {selectedYear !== null && (
            <span className="filter-tag" style={{ display: 'inline-flex' }}>
              <span>Year: <strong>{selectedYear}</strong></span>
              <i className="fa-solid fa-xmark remove-filter" onClick={() => onYearChange(null)}></i>
            </span>
          )}
          {selectedCountry !== null && (
            <span className="filter-tag" style={{ display: 'inline-flex' }}>
              <span>Patent Office: <strong>{selectedCountry}</strong></span>
              <i className="fa-solid fa-xmark remove-filter" onClick={() => onCountryChange(null)}></i>
            </span>
          )}
          <button 
            className="clear-filters-btn"
            onClick={() => {
              onYearChange(null);
              onCountryChange(null);
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <h3><i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent-purple)' }}></i> Top Technology Domains</h3>
            <p>Distribution of patented inventions by domain tags</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={domainsCanvasRef} id="domainsChart"></canvas>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3><i className="fa-solid fa-chart-bar" style={{ color: 'var(--accent-blue)' }}></i> Yearly Patent Families (Priority Date)</h3>
            <p>Annual trend of newly registered inventions (Click bar to filter)</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={yearlyCanvasRef} id="yearlyChart"></canvas>
          </div>
        </div>
      </div>

      {/* Global Density Map Card */}
      <div className="map-card">
        <div className="map-header">
          <div className="map-title-info">
            <h3><i className="fa-solid fa-earth-americas" style={{ color: 'var(--accent-blue)' }}></i> Global Patent Extensions Density</h3>
            <p id="map-description">
              Density map representing total filings by national/regional authority in {selectedCompany ? selectedCompany.toUpperCase() : 'Global'} portfolio
            </p>
          </div>
          <div className="map-legend">
            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: '2px' }}></span> Low Filings
            <span style={{ display: 'inline-block', width: '30px', height: '6px', background: 'linear-gradient(90deg, rgba(59,130,246,0.15), #00d2ff)', margin: '0 6px', borderRadius: '2px' }}></span>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#00d2ff', borderRadius: '2px' }}></span> High Filings ({maxDensityVal.toLocaleString()}+)
          </div>
        </div>
        <div className="map-wrapper" ref={mapContainerRef} style={{ position: 'relative' }}>
          {/* SVG Map gets appended here */}
        </div>
        <div ref={mapTooltipRef} className="map-tooltip" style={{ opacity: 0 }}></div>
      </div>
    </section>
  );
}
