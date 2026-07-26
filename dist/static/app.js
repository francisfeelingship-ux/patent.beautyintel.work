// Patent Analytical Dashboard Core Logic
document.addEventListener("DOMContentLoaded", () => {
    checkStartupStatus();
});

async function checkStartupStatus() {
    const overlay = document.getElementById("loading-overlay");
    const progressBar = document.getElementById("loading-progress-bar");
    const statusText = document.getElementById("loading-status-text");
    const percentageText = document.getElementById("loading-percentage");
    const errorBox = document.getElementById("loading-error");
    const errorText = document.getElementById("loading-error-text");
    
    let retryCount = 0;
    
    const poll = async () => {
        try {
            const response = await fetch("/api/status");
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === "ready") {
                progressBar.style.width = "100%";
                percentageText.innerText = "100%";
                statusText.innerText = "Initializing Dashboard...";
                
                setTimeout(() => {
                    overlay.classList.add("fade-out");
                    initApp();
                }, 600);
            } else if (data.status === "error") {
                progressBar.style.width = "0%";
                percentageText.style.display = "none";
                statusText.style.display = "none";
                errorText.innerText = data.error || "A critical error occurred during backend startup.";
                errorBox.style.display = "flex";
            } else {
                const progress = data.progress || 0;
                progressBar.style.width = `${progress}%`;
                percentageText.innerText = `${progress}%`;
                statusText.innerText = data.detail || "Loading system modules...";
                
                setTimeout(poll, 800);
            }
        } catch (err) {
            console.error("Startup polling error:", err);
            
            retryCount++;
            if (retryCount > 30) {
                progressBar.style.width = "0%";
                percentageText.style.display = "none";
                statusText.style.display = "none";
                errorText.innerText = "Cannot connect to the backend server. Make sure the server is running.";
                errorBox.style.display = "flex";
            } else {
                statusText.innerText = "Waiting for backend server to respond...";
                setTimeout(poll, 1000);
            }
        }
    };
    
    poll();
}

// Global state
const state = {
    overviewData: null,
    searchResults: [],
    selectedFamilyId: null,
    selectedNodeId: null,
    charts: {
        domains: null,
        yearly: null
    },
    searchType: "hybrid",
    rankingMethod: "standard",
    graphSimulation: null,
    graphSvg: null,
    filterYear: null,
    filterCountry: null,
    filterCompany: "", // empty string for all companies
    companyColors: {
        "loreal": 0,
        "beiersdorf": 1,
        "procter_gamble": 2,
        "shiseido": 3,
        "unilever": 4
    }
};

// Map ISO-3 country codes to ISO-2 for matching TopoJSON ids (which are numeric or ISO3)
const numericToAlpha2 = {
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

function initApp() {
    setupTabs();
    setupSearch();
    setupDetailDrawer();
    setupOverviewFilters();
    setupCompanySelector();
    setupResearchAssistant();
}

/* ==========================================================================
   Tab Navigation Setup
   ========================================================================== */
function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const headerFilters = document.querySelector(".header-filters");
    
    // Set initial visibility based on active tab
    const activeTabBtn = document.querySelector(".tab-btn.active");
    if (activeTabBtn && headerFilters) {
        const targetTab = activeTabBtn.getAttribute("data-tab");
        if (targetTab === "overview") {
            headerFilters.style.display = "flex";
        } else {
            headerFilters.style.display = "none";
        }
    }
    
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.getAttribute("id") === `tab-${targetTab}`) {
                    content.classList.add("active");
                }
            });
            
            // Show/hide company select dropdown
            if (headerFilters) {
                if (targetTab === "overview") {
                    headerFilters.style.display = "flex";
                } else {
                    headerFilters.style.display = "none";
                    if (state.filterCompany !== "") {
                        state.filterCompany = "";
                        const companySelect = document.getElementById("company-select");
                        if (companySelect) {
                            companySelect.value = "";
                        }
                        
                        // Update header texts dynamically to default
                        const mainTitle = document.getElementById("header-main-title");
                        const subTitle = document.getElementById("header-sub-title");
                        if (mainTitle) mainTitle.innerText = "PATENT LIBRARY";
                        if (subTitle) subTitle.innerText = "GLOBAL ANALYTICS & INTELLIGENCE";
                        
                        // Refetch overview data to update the global stats back to all patent count
                        fetchOverview();
                        
                        // Clear search results to avoid mismatched queries
                        clearSearchResults();
                        
                        // Update 3D Point Cloud colors dynamically if initialized
                        if (cloudInitialized) {
                            updateCloudColors();
                        }
                    }
                }
            }
            
            if (targetTab === "overview" && !state.overviewData) {
                fetchOverview();
            }
            
            if (targetTab === "cloud") {
                startCloud();
            } else {
                stopCloud();
            }
        });
    });
}

/* ==========================================================================
   Company Selector Setup
   ========================================================================== */
async function setupCompanySelector() {
    const select = document.getElementById("company-select");
    
    try {
        const response = await fetch("/api/companies");
        if (!response.ok) throw new Error("Failed to fetch companies");
        const companies = await response.json();
        
        companies.forEach(company => {
            const opt = document.createElement("option");
            opt.value = company.key;
            opt.innerText = company.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Error loading companies list:", err);
    }
    
    select.addEventListener("change", (e) => {
        state.filterCompany = e.target.value;
        
        // Update header texts dynamically
        const mainTitle = document.getElementById("header-main-title");
        const subTitle = document.getElementById("header-sub-title");
        const selectedOptionText = select.options[select.selectedIndex].text;
        
        if (state.filterCompany === "") {
            mainTitle.innerText = "PATENT LIBRARY";
            subTitle.innerText = "GLOBAL ANALYTICS & INTELLIGENCE";
        } else {
            mainTitle.innerText = selectedOptionText.toUpperCase();
            subTitle.innerText = "PATENT ANALYTICS & INTELLIGENCE";
        }
        
        // Reset current active filters when company switches
        state.filterYear = null;
        state.filterCountry = null;
        updateActiveFiltersUI();
        
        // Trigger data reloading
        fetchOverview();
        
        // Clear search results to avoid mismatched queries
        clearSearchResults();
        
        // Update 3D Point Cloud colors dynamically if initialized
        if (cloudInitialized) {
            updateCloudColors();
        }
    });
    
    // Initial fetch of overview statistics
    fetchOverview();
}

function clearSearchResults() {
    const listContainer = document.getElementById("results-list");
    const countTitle = document.getElementById("results-count-title");
    const searchInput = document.getElementById("search-input");
    
    searchInput.value = "";
    document.getElementById("clear-search-btn").style.display = "none";
    countTitle.innerText = "Inventions";
    
    listContainer.innerHTML = `
        <div class="empty-results-state">
            <i class="fa-solid fa-search"></i>
            <h4>Find Inventions</h4>
            <p>Enter a query above to explore patent portfolios using keyword, neural vector similarity, or combined hybrid search.</p>
        </div>
    `;
    
    // Clear graph
    d3.select("#graph-container svg").remove();
    if (state.graphSimulation) state.graphSimulation.stop();
    
    document.getElementById("graph-placeholder").style.display = "flex";
    document.getElementById("graph-placeholder").innerHTML = `
        <i class="fa-solid fa-diagram-project"></i>
        <h4>Interactive Visualization</h4>
        <p>Once selected, we will build an interactive force-directed graph showing the root application, national equivalents, and citation links.</p>
    `;
    document.getElementById("graph-legend-overlay").style.display = "none";
    document.getElementById("graph-controls").style.display = "none";
    document.getElementById("graph-family-title").innerText = "Equivalent Family Tree & Citation Graph";
    document.getElementById("graph-family-subtitle").innerText = "Select an invention from the list to view its global filing members and prior art citation network";
    state.selectedFamilyId = null;
}

/* ==========================================================================
   API: Get Overview Statistics and Render
   ========================================================================== */
async function fetchOverview() {
    try {
        let url = "/api/overview";
        const params = [];
        if (state.filterCompany) params.push(`company=${encodeURIComponent(state.filterCompany)}`);
        if (state.filterYear !== null) params.push(`year=${state.filterYear}`);
        if (state.filterCountry !== null) params.push(`country=${encodeURIComponent(state.filterCountry)}`);
        
        if (params.length > 0) {
            url += "?" + params.join("&");
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch overview data");
        const data = await response.json();
        
        state.overviewData = data;
        renderOverviewMetrics(data);
        renderOverviewCharts(data);
        renderOverviewMap(data.country_densities);
    } catch (error) {
        console.error("Error loading overview metrics:", error);
    }
}

/* ==========================================================================
   Overview Cross-Filtering Setup & Logic
   ========================================================================== */
function setupOverviewFilters() {
    document.getElementById("remove-filter-year").addEventListener("click", () => {
        toggleYearFilter(null);
    });
    
    document.getElementById("remove-filter-country").addEventListener("click", () => {
        toggleCountryFilter(null);
    });
    
    document.getElementById("clear-filters-btn").addEventListener("click", () => {
        state.filterYear = null;
        state.filterCountry = null;
        updateActiveFiltersUI();
        fetchOverview();
    });
}

function toggleYearFilter(year) {
    if (state.filterYear === year) {
        state.filterYear = null;
    } else {
        state.filterYear = year;
    }
    updateActiveFiltersUI();
    fetchOverview();
}

function toggleCountryFilter(country) {
    if (state.filterCountry === country) {
        state.filterCountry = null;
    } else {
        state.filterCountry = country;
    }
    updateActiveFiltersUI();
    fetchOverview();
}

function updateActiveFiltersUI() {
    const row = document.getElementById("active-filters-row");
    const yearTag = document.getElementById("filter-tag-year");
    const yearVal = document.getElementById("filter-val-year");
    const countryTag = document.getElementById("filter-tag-country");
    const countryVal = document.getElementById("filter-val-country");
    
    if (state.filterYear === null && state.filterCountry === null) {
        row.style.display = "none";
        return;
    }
    
    row.style.display = "flex";
    
    if (state.filterYear !== null) {
        yearVal.innerText = state.filterYear;
        yearTag.style.display = "inline-flex";
    } else {
        yearTag.style.display = "none";
    }
    
    if (state.filterCountry !== null) {
        countryVal.innerText = state.filterCountry;
        countryTag.style.display = "inline-flex";
    } else {
        countryTag.style.display = "none";
    }
}

function renderOverviewMetrics(data) {
    document.getElementById("stat-total-patents").innerText = data.total_patents.toLocaleString();
    document.getElementById("stat-total-families").innerText = data.total_families.toLocaleString();
    
    // Find top extension country
    const sortedCountries = Object.entries(data.country_densities)
        .filter(([c]) => c !== "WO" && c !== "EP" && c !== "IB")
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedCountries.length > 0) {
        document.getElementById("metric-top-country").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${sortedCountries[0][0]}`;
    } else {
        document.getElementById("metric-top-country").innerHTML = `<i class="fa-solid fa-location-dot"></i> N/A`;
    }
    
    if (data.domains.length > 0) {
        const formatTag = tag => tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        document.getElementById("metric-top-domain").innerText = formatTag(data.domains[0].domain);
    } else {
        document.getElementById("metric-top-domain").innerText = "N/A";
    }
    
    if (data.yearly_filings.length > 0) {
        const sortedYears = [...data.yearly_filings].sort((a, b) => b.count - a.count);
        document.getElementById("metric-peak-year").innerText = sortedYears[0].year;
    } else {
        document.getElementById("metric-peak-year").innerText = "N/A";
    }
}

function renderOverviewCharts(data) {
    const formatTag = tag => tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // 1. Domains Donut Chart
    const domainsCtx = document.getElementById("domainsChart").getContext("2d");
    const domainLabels = data.domains.map(d => formatTag(d.domain));
    const domainCounts = data.domains.map(d => d.count);
    
    if (state.charts.domains) state.charts.domains.destroy();
    
    const colors = [
        '#00d2ff', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', 
        '#f59e0b', '#ef4444', '#6366f1', '#a855f7', '#06b6d4',
        '#14b8a6', '#f43f5e', '#fbbf24', '#34d399', '#60a5fa',
        '#c084fc', '#f472b6', '#22d3ee', '#818cf8', '#fb7185'
    ];
    
    state.charts.domains = new Chart(domainsCtx, {
        type: 'doughnut',
        data: {
            labels: domainLabels,
            datasets: [{
                data: domainCounts,
                backgroundColor: colors.slice(0, domainLabels.length),
                borderWidth: 1,
                borderColor: '#111827'
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
                        padding: 10,
                        boxWidth: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return ` ${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
    
    // 2. Yearly Priority Filings Bar Chart
    const yearlyCtx = document.getElementById("yearlyChart").getContext("2d");
    const yearlyLabels = data.yearly_filings.map(d => d.year);
    const yearlyCounts = data.yearly_filings.map(d => d.count);
    
    if (state.charts.yearly) state.charts.yearly.destroy();
    
    const gradient = yearlyCtx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#00d2ff');
    gradient.addColorStop(1, '#8b5cf6');
    
    const barColors = yearlyLabels.map(year => {
        if (state.filterYear !== null) {
            return year === state.filterYear ? '#00d2ff' : 'rgba(59, 130, 246, 0.12)';
        }
        return gradient;
    });
    
    const barHoverColors = yearlyLabels.map(year => {
        return '#00d2ff';
    });
    
    state.charts.yearly = new Chart(yearlyCtx, {
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
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const clickedYear = yearlyLabels[index];
                    toggleYearFilter(clickedYear);
                }
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b7280', font: { family: 'Inter' } }
                }
            }
        }
    });
}

function renderOverviewMap(densities) {
    const container = document.getElementById("world-map-container");
    container.innerHTML = "";
    
    const tooltip = document.getElementById("map-tooltip");
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const svg = d3.select("#world-map-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
        
    const g = svg.append("g");
    
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
        
    svg.call(zoom);
    
    const projection = d3.geoNaturalEarth1()
        .scale(width / 5.8)
        .translate([width / 2.1, height / 1.7]);
        
    const path = d3.geoPath().projection(projection);
    
    const densityValues = Object.entries(densities)
        .filter(([c]) => c !== "WO" && c !== "EP" && c !== "IB")
        .map(([_, v]) => v);
    
    const maxVal = d3.max(densityValues) || 1;
    
    const colorScale = d3.scaleLog()
        .domain([1, maxVal])
        .range(["rgba(59, 130, 246, 0.15)", "#00d2ff"]);
        
    const legendContainer = document.getElementById("map-legend");
    legendContainer.innerHTML = `
        <span style="display:inline-block;width:10px;height:10px;background:rgba(59,130,246,0.15);border-radius:2px;"></span> Low Filings
        <span style="display:inline-block;width:30px;height:6px;background:linear-gradient(90deg, rgba(59,130,246,0.15), #00d2ff);margin:0 4px;border-radius:2px;"></span>
        <span style="display:inline-block;width:10px;height:10px;background:#00d2ff;border-radius:2px;"></span> High Filings (${maxVal.toLocaleString()}+)
    `;

    // Map description text updating
    const mapDesc = document.getElementById("map-description");
    const select = document.getElementById("company-select");
    const selectedOptionText = select.options[select.selectedIndex].text;
    mapDesc.innerText = `Density map representing total filings by national/regional authority in ${selectedOptionText}'s portfolio`;

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
        const countries = topojson.feature(worldData, worldData.objects.countries).features;
        
        g.selectAll("path")
            .data(countries)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", "country")
            .attr("fill", d => {
                const alpha2 = numericToAlpha2[d.id];
                const count = densities[alpha2] || 0;
                return count > 0 ? colorScale(count) : "rgba(255, 255, 255, 0.03)";
            })
            .attr("stroke", d => {
                const alpha2 = numericToAlpha2[d.id];
                return alpha2 === state.filterCountry ? '#ffffff' : '#161c28';
            })
            .attr("stroke-width", d => {
                const alpha2 = numericToAlpha2[d.id];
                return alpha2 === state.filterCountry ? '2.5px' : '0.5px';
            })
            .style("opacity", d => {
                const alpha2 = numericToAlpha2[d.id];
                if (state.filterCountry) {
                    return alpha2 === state.filterCountry ? 1.0 : 0.45;
                }
                return 1.0;
            })
            .on("click", (event, d) => {
                const alpha2 = numericToAlpha2[d.id];
                if (alpha2) {
                    toggleCountryFilter(alpha2);
                }
            })
            .on("mouseover", (event, d) => {
                const alpha2 = numericToAlpha2[d.id] || "Unknown";
                const countryName = d.properties.name;
                const count = densities[alpha2] || 0;
                
                tooltip.style.opacity = 1;
                tooltip.innerHTML = `
                    <div style="font-weight:600;margin-bottom:4px;">${countryName} (${alpha2})</div>
                    <div>Filings Count: <span style="color:#00d2ff;font-weight:700;">${count.toLocaleString()}</span></div>
                `;
            })
            .on("mousemove", (event) => {
                const rect = container.getBoundingClientRect();
                tooltip.style.left = (event.clientX - rect.left + 15) + "px";
                tooltip.style.top = (event.clientY - rect.top - 15) + "px";
            })
            .on("mouseleave", () => {
                tooltip.style.opacity = 0;
            });
    }).catch(err => {
        console.error("Error loading world atlas TopoJSON:", err);
        container.innerHTML = `<div class="empty-results-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Map Failed to Load</h4><p>Could not fetch world map topology data from the CDN.</p></div>`;
    });
}

/* ==========================================================================
   Search Functionality
   ========================================================================== */
function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const clearBtn = document.getElementById("clear-search-btn");
    const searchBtn = document.getElementById("search-btn");
    
    searchInput.addEventListener("input", () => {
        clearBtn.style.display = searchInput.value ? "block" : "none";
    });
    
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        searchInput.focus();
    });
    
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            triggerSearch();
        }
    });
    
    searchBtn.addEventListener("click", triggerSearch);
    
    const radios = document.querySelectorAll("input[name='search-type']");
    radios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            state.searchType = e.target.value;
            triggerSearch();
        });
    });

    const sortSelect = document.getElementById("search-sort-select");
    if (sortSelect) {
        sortSelect.value = state.rankingMethod;
        sortSelect.addEventListener("change", (e) => {
            state.rankingMethod = e.target.value;
            triggerSearch();
        });
    }
}

async function triggerSearch() {
    const query = document.getElementById("search-input").value.trim();
    const loader = document.getElementById("results-loader");
    const listContainer = document.getElementById("results-list");
    
    loader.style.display = "block";
    
    try {
        let url = `/api/search?q=${encodeURIComponent(query)}&type=${state.searchType}&limit=50&sort=${state.rankingMethod}`;
        if (state.filterCompany) {
            url += `&company=${encodeURIComponent(state.filterCompany)}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Search request failed");
        const results = await response.json();
        
        state.searchResults = results;
        renderSearchResults(results);
    } catch (err) {
        console.error("Search error:", err);
        listContainer.innerHTML = `
            <div class="empty-results-state">
                <i class="fa-solid fa-triangle-exclamation" style="color:var(--color-warning);"></i>
                <h4>Search Error</h4>
                <p>There was a problem executing your query. Please check your network connection.</p>
            </div>
        `;
    } finally {
        loader.style.display = "none";
    }
}

function renderSearchResults(results) {
    const listContainer = document.getElementById("results-list");
    const titleContainer = document.getElementById("results-count-title");
    
    listContainer.innerHTML = "";
    titleContainer.innerText = `Inventions (${results.length})`;
    
    if (results.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-results-state">
                <i class="fa-solid fa-folder-open"></i>
                <h4>No Results Found</h4>
                <p>We couldn't find any patents matching your query. Try different keywords or switch search strategy.</p>
            </div>
        `;
        return;
    }
    
    const formatTag = tag => tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    results.forEach(item => {
        const card = document.createElement("div");
        card.className = "result-card";
        if (state.selectedFamilyId === item.family_id) {
            card.classList.add("active");
        }
        
        const scorePct = Math.round(item.score * 100);
        let scoreBadge = `<span class="card-score"><i class="fa-solid fa-chart-simple"></i> Match: ${scorePct}%</span>`;
        
        if (item.search_method === "keyword") {
            scoreBadge = `<span class="card-score" style="color:var(--accent-blue);background:rgba(0,210,255,0.08);border:1px solid rgba(0,210,255,0.15);"><i class="fa-solid fa-key"></i> Keyword (FTS5)</span>`;
        } else if (item.search_method === "vector") {
            scoreBadge = `<span class="card-score" style="color:#22d3ee;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.15);"><i class="fa-solid fa-network-wired"></i> Neural: ${scorePct}%</span>`;
        } else if (item.search_method === "hybrid_rrf") {
            scoreBadge = `<span class="card-score" style="color:#d8b4fe;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);"><i class="fa-solid fa-bolt"></i> Hybrid RRF</span>`;
        }
        
        const tagsHtml = item.domain_tags.slice(0, 2)
            .map(t => `<span class="card-tag">${formatTag(t)}</span>`)
            .join("");
            
        card.innerHTML = `
            <div class="card-top">
                <span class="card-id">${item.family_id}</span>
                ${scoreBadge}
            </div>
            <div class="card-title">${item.title}</div>
            <div class="card-meta">
                <span>Priority: <strong>${item.priority_year || "N/A"}</strong></span>
                <span>Size: <strong>${item.family_size} publications</strong></span>
            </div>
            <div class="card-tags">
                <span class="card-tag" style="color:var(--accent-blue);border-color:rgba(0,210,255,0.25);font-weight:600;"><i class="fa-solid fa-building"></i> ${item.assignee}</span>
                ${tagsHtml}
            </div>
        `;
        
        card.addEventListener("click", () => {
            document.querySelectorAll(".result-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            
            state.selectedFamilyId = item.family_id;
            loadFamilyGraph(item.family_id);
        });
        
        listContainer.appendChild(card);
    });
}

/* ==========================================================================
   Family Tree Graph D3 Visualization
   ========================================================================== */
async function loadFamilyGraph(familyId) {
    const placeholder = document.getElementById("graph-placeholder");
    const container = document.getElementById("graph-container");
    const legend = document.getElementById("graph-legend-overlay");
    const controls = document.getElementById("graph-controls");
    
    document.getElementById("graph-family-title").innerText = `Generating Family Graph: ${familyId}...`;
    document.getElementById("graph-family-subtitle").innerText = "Analyzing equivalence paths and citation overlaps...";
    
    placeholder.style.display = "flex";
    placeholder.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i><h4>Loading Family Network</h4><p>Querying citation links and members...</p>`;
    
    try {
        const response = await fetch(`/api/family/${familyId}/graph`);
        if (!response.ok) throw new Error("Failed to load family graph");
        const graphData = await response.json();
        
        placeholder.style.display = "none";
        legend.style.display = "flex";
        controls.style.display = "flex";
        
        document.getElementById("graph-family-title").innerText = graphData.title;
        const totalPubCount = graphData.visible_publication_count || graphData.family_size || graphData.nodes.length;
        document.getElementById("graph-family-subtitle").innerText = `Family ${familyId} • Priority Year: ${graphData.priority_year || 'N/A'} • Size: ${totalPubCount} publications`;
        
        renderFamilyGraph(graphData);
    } catch (err) {
        console.error("Error loading graph:", err);
        placeholder.style.display = "flex";
        placeholder.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-warning);"></i><h4>Visualization Error</h4><p>Failed to parse structural nodes and edges for this family.</p>`;
        legend.style.display = "none";
        controls.style.display = "none";
    }
}

function renderFamilyGraph(graphData) {
    const container = document.getElementById("graph-container");
    
    d3.select("#graph-container svg").remove();
    if (state.graphSimulation) state.graphSimulation.stop();
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const svg = d3.select("#graph-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
        
    state.graphSvg = svg;
    const g = svg.append("g");
    
    svg.append("defs").selectAll("marker")
        .data(["citation"])
        .enter().append("marker")
        .attr("id", d => d)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L10,0L0,4")
        .attr("class", "d3-arrow citation");
        
    const zoom = d3.zoom()
        .scaleExtent([0.2, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
        
    svg.call(zoom);
    
    document.getElementById("btn-zoom-in").onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
    document.getElementById("btn-zoom-out").onclick = () => svg.transition().call(zoom.scaleBy, 1 / 1.3);
    document.getElementById("btn-zoom-fit").onclick = () => {
        svg.transition().call(zoom.transform, d3.zoomIdentity.translate(0,0).scale(1));
    };
    
    const simulation = d3.forceSimulation(graphData.nodes)
        .force("link", d3.forceLink(graphData.edges).id(d => d.id).distance(d => d.type === "equivalent" ? 75 : 150))
        .force("charge", d3.forceManyBody().strength(-220))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(35));
        
    state.graphSimulation = simulation;
    
    const link = g.append("g")
        .selectAll("line")
        .data(graphData.edges)
        .enter().append("line")
        .attr("class", d => `link-line ${d.type}`)
        .attr("stroke", d => d.type === "equivalent" ? "rgba(255, 255, 255, 0.3)" : "var(--accent-purple)")
        .attr("stroke-width", d => d.type === "equivalent" ? 1.5 : 2.0)
        .attr("marker-end", d => d.type === "citation" ? "url(#citation)" : null);
        
    const tooltip = document.getElementById("graph-tooltip");
    
    const node = g.append("g")
        .selectAll("g")
        .data(graphData.nodes)
        .enter().append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );
        
    node.append("circle")
        .attr("class", "node-circle")
        .attr("r", d => d.is_representative ? 14 : (d.type === "sibling" ? 10 : 7))
        .attr("fill", d => {
            if (d.is_representative) return "var(--accent-blue)";
            if (d.type === "sibling") return d.has_text ? "#00d2ff" : "#3b82f6";
            return "var(--accent-purple)";
        })
        .attr("stroke", d => d.is_representative ? "#ffffff" : "#07090e")
        .attr("stroke-width", d => d.is_representative ? 3.5 : 1.5)
        .on("mouseover", (event, d) => {
            tooltip.style.opacity = 1;
            let typeLabel = d.is_representative ? "★ Core Representative" : (d.type === "sibling" ? "Sibling Publication" : "Global EPO Equivalent");
            tooltip.innerHTML = `
                <div style="font-weight:700;color:${d.is_representative ? 'var(--text-bright)' : 'var(--accent-blue)'};">${d.label} [${d.country}]</div>
                <div style="font-size:0.75rem;margin-top:2px;max-width:260px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${d.title}</div>
                <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px;">Assignee: ${d.assignee}</div>
                <div style="font-size:0.72rem;color:var(--accent-pink);margin-top:2px;font-weight:600;">Role: ${typeLabel}</div>
            `;
        })
        .on("mousemove", (event) => {
            const rect = container.getBoundingClientRect();
            tooltip.style.left = (event.clientX - rect.left + 15) + "px";
            tooltip.style.top = (event.clientY - rect.top - 15) + "px";
        })
        .on("mouseleave", () => {
            tooltip.style.opacity = 0;
        })
        .on("click", (event, d) => {
            event.stopPropagation();
            tooltip.style.opacity = 0;
            openNodeDetails(d, graphData.abstract);
        });
        
    node.append("text")
        .attr("class", "node-text")
        .attr("dx", d => d.is_representative ? 17 : 13)
        .attr("dy", ".35em")
        .style("font-weight", d => d.is_representative ? "700" : "500")
        .style("fill", d => d.is_representative ? "var(--text-bright)" : "var(--text-secondary)")
        .text(d => d.label);
        
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
            
        node
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
    });
    
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

/* ==========================================================================
   Detail Drawer Setup
   ========================================================================== */
function setupDetailDrawer() {
    const closeBtn = document.getElementById("drawer-close-btn");
    const drawer = document.getElementById("detail-drawer");
    
    const closeDrawer = () => {
        if (drawer) drawer.classList.remove("active");
        state.selectedNodeId = null;
    };
    
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
    });

    document.addEventListener("click", (e) => {
        if (!drawer || !drawer.classList.contains("active")) return;
        if (drawer.contains(e.target)) return;
        if (e.target.closest(".node-circle") || e.target.closest(".result-card") || e.target.closest("#detail-drawer")) return;
        closeDrawer();
    });
    
    const descBtn = document.getElementById("drawer-description-btn");
    const descContainer = document.getElementById("drawer-description-container");
    
    if (descBtn && descContainer) {
        descBtn.addEventListener("click", async () => {
            if (descContainer.style.display !== "none" && descContainer.innerHTML && !descBtn.disabled) {
                descContainer.style.display = "none";
                descBtn.innerHTML = `<i class="fa-solid fa-file-signature"></i> Pull Full Description`;
                return;
            }
            
            if (descContainer.innerHTML && !descContainer.querySelector(".error-message-desc") && descContainer.style.display === "none") {
                descContainer.style.display = "block";
                descBtn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Hide Full Description`;
                return;
            }
            
            const badgeEl = document.getElementById("drawer-badge-id");
            const pubNumber = badgeEl ? badgeEl.innerText.trim() : "";
            if (!pubNumber) return;
            
            descBtn.disabled = true;
            descBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Pulling description...`;
            
            try {
                const response = await fetch(`/api/patent/${encodeURIComponent(pubNumber)}/description`);
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error("Full description not available for this publication.");
                    } else {
                        throw new Error("Failed to load description from server.");
                    }
                }
                const data = await response.json();
                
                descContainer.textContent = data.text_content || "No description content returned.";
                descContainer.style.display = "block";
                descBtn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Hide Full Description`;
            } catch (err) {
                console.error("Error loading patent description:", err);
                descContainer.innerHTML = `<span class="error-message-desc" style="color:var(--color-warning);display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</span>`;
                descContainer.style.display = "block";
                descBtn.innerHTML = `<i class="fa-solid fa-file-signature"></i> Pull Full Description`;
            } finally {
                descBtn.disabled = false;
            }
        });
    }
}

function openNodeDetails(node, familyAbstract) {
    try {
        const drawer = document.getElementById("detail-drawer");
        
        if (!drawer) {
            console.error("Detail drawer element not found in DOM");
            return;
        }

        if (!node) {
            console.warn("openNodeDetails called with null or undefined node");
            return;
        }
        
        state.selectedNodeId = node.id || null;
        
        const badgeLabel = node.label || node.id || "Publication";
        const titleText = node.title || "No Title Available";
        const countryCode = (node.country || (badgeLabel.length >= 2 ? badgeLabel.slice(0, 2) : "XX")).toUpperCase();
        const filingDate = node.filing_date || "N/A (Equivalent Only)";
        const pubDate = node.publication_date || "N/A (Equivalent Only)";
        const kindCode = node.kind_code || "N/A";
        const assignee = node.assignee || "Unknown";
        const abstractText = node.abstract || familyAbstract || "No abstract available.";

        const badgeEl = document.getElementById("drawer-badge-id");
        const titleEl = document.getElementById("drawer-title");
        const countryEl = document.getElementById("drawer-country");
        const filingDateEl = document.getElementById("drawer-filing-date");
        const pubDateEl = document.getElementById("drawer-pub-date");
        const kindCodeEl = document.getElementById("drawer-kind-code");
        const assigneeEl = document.getElementById("drawer-assignee");
        const abstractEl = document.getElementById("drawer-abstract");

        if (badgeEl) badgeEl.innerText = badgeLabel;
        if (titleEl) titleEl.innerText = titleText;
        if (countryEl) countryEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${countryCode}`;
        if (filingDateEl) filingDateEl.innerText = filingDate;
        if (pubDateEl) pubDateEl.innerText = pubDate;
        if (kindCodeEl) kindCodeEl.innerText = kindCode;
        if (assigneeEl) assigneeEl.innerText = assignee;
        if (abstractEl) abstractEl.innerText = abstractText;
        
        const descBtn = document.getElementById("drawer-description-btn");
        const descContainer = document.getElementById("drawer-description-container");
        const descDivider = document.getElementById("drawer-description-divider");
        const descSection = document.getElementById("drawer-description-section");
        
        if (descBtn) {
            descBtn.disabled = false;
            descBtn.innerHTML = `<i class="fa-solid fa-file-signature"></i> Pull Full Description`;
        }
        if (descContainer) {
            descContainer.style.display = "none";
            descContainer.innerHTML = "";
        }
        
        const hasTextSupport = node.is_representative || node.type === "sibling" || node.type === "core" || node.type === "equivalent_with_text" || node.has_text;
        if (descDivider) descDivider.style.display = hasTextSupport ? "block" : "none";
        if (descSection) descSection.style.display = hasTextSupport ? "block" : "none";
        
        drawer.classList.add("active");
    } catch (err) {
        console.error("Error in openNodeDetails:", err);
    }
}

/* ==========================================================================
   3D Point Cloud Tab Setup & Logic
   ========================================================================== */
let cloudInitialized = false;
let cloudScene, cloudCamera, cloudRenderer, cloudControls;
let cloudGroup, cloudPoints;
let cloudRaycaster = new THREE.Raycaster();
let cloudMouse = new THREE.Vector2();
let cloudHoveredPointIdx = -1;
let cloudDataPoints = [];
let cloudAnimationId = null;

// Dynamic company neon color generator
const CLOUD_COLORS = [
    new THREE.Color('#ff007f'), // Neon pink
    new THREE.Color('#00d2ff'), // Neon cyan
    new THREE.Color('#8b5cf6'), // Neon purple
    new THREE.Color('#f59e0b'), // Neon orange
    new THREE.Color('#10b981')  // Neon green
];

// Dynamic company neon color generator based on slot index in state.companyColors
function getCompanyColor(key) {
    const idx = state.companyColors[key];
    if (idx !== undefined && idx >= 0 && idx < CLOUD_COLORS.length) {
        return CLOUD_COLORS[idx];
    }
    return new THREE.Color('#4b5563'); // Muted gray for others
}

let domains = [
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

// Helper to create a radial gradient round particle texture for glowing dots
function createPointTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
}

// Helper to create readable billboard labels for tech domain centers
function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Glassmorphic background pill
    ctx.fillStyle = 'rgba(11, 16, 27, 0.82)';
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
    ctx.lineWidth = 4;
    
    const x = 8, y = 8, w = canvas.width - 16, h = canvas.height - 16, r = 20;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Label Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Inter, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const formatted = text.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    ctx.fillText(formatted, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    
    sprite.scale.set(64, 16, 1);
    return sprite;
}

async function loadCloudData() {
    const checkboxes = document.querySelectorAll(".company-checkbox-input");
    const checkedKeys = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => c.value);
        
    const keysStr = checkedKeys.join(",");
    const response = await fetch(`/api/domain-cloud-data?companies=${encodeURIComponent(keysStr)}&t=${Date.now()}`);
    if (!response.ok) throw new Error("Failed to fetch 3D cloud data");
    const data = await response.json();
    
    // Always enforce the canonical 9 domain names — ignore any wrong names from the API
    const CANONICAL_DOMAINS = [
        'skin_care', 'hair_care', 'therapeutic_application',
        'makeup_color_cosmetics', 'oral_care', 'cleansing_formula',
        'food_beverage', 'sunscreen_photoprotection', 'hair_color'
    ];
    if (data.domains && data.domains.length > 0) {
        // Only keep domains that are in our canonical list; preserve canonical order
        const fromApi = new Set(data.domains);
        const filtered = CANONICAL_DOMAINS.filter(d => fromApi.has(d));
        domains = filtered.length > 0 ? filtered : CANONICAL_DOMAINS;
    } else {
        domains = CANONICAL_DOMAINS;
    }
    // Filter points to only those whose domain is canonical
    cloudDataPoints = (data.points || []).filter(p => CANONICAL_DOMAINS.includes(p[2]));
}

function enforceCheckboxLimit() {
    const checkboxes = document.querySelectorAll(".company-checkbox-input");
    const checked = Array.from(checkboxes).filter(c => c.checked);
    
    checkboxes.forEach(cb => {
        const label = cb.closest(".company-checkbox-label");
        if (cb.checked) {
            label.classList.add("checked");
            label.classList.remove("disabled");
            cb.disabled = false;
        } else {
            label.classList.remove("checked");
            if (checked.length >= 5) {
                label.classList.add("disabled");
                cb.disabled = true;
            } else {
                label.classList.remove("disabled");
                cb.disabled = false;
            }
        }
    });
}

function rebuildCloudLegend() {
    const legendContainer = document.getElementById("cloud-legend-overlay");
    if (!legendContainer) return;
    
    const titleElement = legendContainer.querySelector(".cloud-legend-title");
    legendContainer.innerHTML = "";
    if (titleElement) legendContainer.appendChild(titleElement);
    
    const checkboxes = document.querySelectorAll(".company-checkbox-input");
    const checkedKeys = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => c.value);
        
    // Sort checkedKeys by their assigned color slot index (0 to 4) so that Pink is always first, then Blue, etc.
    checkedKeys.sort((a, b) => {
        const idxA = state.companyColors[a] !== undefined ? state.companyColors[a] : 999;
        const idxB = state.companyColors[b] !== undefined ? state.companyColors[b] : 999;
        return idxA - idxB;
    });
        
    checkedKeys.forEach(key => {
        const companyObj = state.companies ? state.companies.find(c => c.key === key) : null;
        const name = companyObj ? companyObj.name : (key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()));
        const color = getCompanyColor(key).getStyle();
        
        const item = document.createElement("div");
        item.className = "cloud-legend-item";
        item.innerHTML = `
            <span class="legend-dot" style="background-color: ${color}"></span>
            <span>${name}</span>
        `;
        legendContainer.appendChild(item);
    });
}

function rebuildCloudGeometry() {
    if (!cloudGroup || !cloudScene) return;
    
    // Clear all existing children from the group (both points and billboards)
    while (cloudGroup.children.length > 0) {
        const obj = cloudGroup.children[0];
        cloudGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    }
    cloudPoints = null;
    
    const domainCenters = {};
    domains.forEach((dom, idx) => {
        const theta = (idx / domains.length) * Math.PI * 2;
        const r = 180;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const y = 35 * Math.sin(theta * 3);
        domainCenters[dom] = new THREE.Vector3(x, y, z);
        
        // Dynamically rebuild billboard labels
        const sprite = createTextSprite(dom);
        sprite.position.set(x, y + 42, z);
        cloudGroup.add(sprite);
    });
    
    const numPoints = cloudDataPoints.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);
    
    for (let i = 0; i < numPoints; i++) {
        const [pub, title, domain, company_key, is_affiliate] = cloudDataPoints[i];
        
        let center = new THREE.Vector3(0, 0, 0);
        if (domainCenters[domain]) {
            center = domainCenters[domain];
        }
        
        const rSpread = 32;
        const u = Math.random();
        const v = Math.random();
        const w = Math.random();
        
        const r = rSpread * Math.cbrt(u);
        const phi = Math.acos(2 * v - 1);
        const theta = Math.PI * 2 * w;
        
        const dx = r * Math.sin(phi) * Math.cos(theta);
        const dy = r * Math.sin(phi) * Math.sin(theta);
        const dz = r * Math.cos(phi);
        
        positions[i * 3] = center.x + dx;
        positions[i * 3 + 1] = center.y + dy;
        positions[i * 3 + 2] = center.z + dz;
        
        let col = getCompanyColor(company_key);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const pointMaterial = new THREE.PointsMaterial({
        size: 2.2,
        map: createPointTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    
    cloudPoints = new THREE.Points(geometry, pointMaterial);
    cloudGroup.add(cloudPoints);
}

async function handleCompanyCheckboxChange() {
    enforceCheckboxLimit();
    
    const loader = document.getElementById("canvas-3d-loader");
    if (loader) {
        loader.style.display = "flex";
        loader.style.opacity = 1;
        loader.querySelector("h4").innerText = "Updating 3D Point Cloud...";
    }
    
    try {
        await loadCloudData();
        rebuildCloudGeometry();
        rebuildCloudLegend();
        updateCheckboxDotColors();
    } catch (err) {
        console.error("Failed to update cloud data:", err);
    } finally {
        if (loader) {
            loader.style.opacity = 0;
            setTimeout(() => {
                loader.style.display = "none";
            }, 500);
        }
    }
}

function updateCheckboxDotColors() {
    const checkboxes = document.querySelectorAll(".company-checkbox-input");
    checkboxes.forEach(cb => {
        const label = cb.closest(".company-checkbox-label");
        if (label) {
            const dot = label.querySelector(".legend-dot");
            if (dot) {
                dot.style.backgroundColor = getCompanyColor(cb.value).getStyle();
            }
        }
    });
}

async function init3DCloud() {
    if (cloudInitialized) return;
    
    const container = document.getElementById("canvas-3d-container");
    if (!container) return;
    
    const loader = document.getElementById("canvas-3d-loader");
    if (loader) loader.style.display = "flex";
    
    try {
        // Fetch companies dynamically to build checklist
        const companyCheckboxesContainer = document.getElementById("company-checkboxes");
        if (companyCheckboxesContainer && companyCheckboxesContainer.children.length === 0) {
            const compResponse = await fetch("/api/companies");
            if (!compResponse.ok) throw new Error("Failed to fetch companies");
            const companies = await compResponse.json();
            state.companies = companies;
            
            const startingKeys = ["loreal", "beiersdorf", "procter_gamble", "shiseido", "unilever"];
            
            companies.forEach(company => {
                const label = document.createElement("label");
                label.className = "company-checkbox-label";
                if (startingKeys.includes(company.key)) {
                    label.classList.add("checked");
                }
                
                const dotColor = getCompanyColor(company.key).getStyle();
                
                label.innerHTML = `
                    <input type="checkbox" class="company-checkbox-input" value="${company.key}" ${startingKeys.includes(company.key) ? 'checked' : ''}>
                    <span class="legend-dot" style="background-color: ${dotColor}"></span>
                    <span>${company.name}</span>
                `;
                
                companyCheckboxesContainer.appendChild(label);
                
                const checkbox = label.querySelector(".company-checkbox-input");
                checkbox.addEventListener("change", () => {
                    const val = checkbox.value;
                    if (checkbox.checked) {
                        // Find the first free color slot (0 to 4)
                        const activeIndices = Object.values(state.companyColors);
                        let freeIndex = 0;
                        for (let idx = 0; idx < 5; idx++) {
                            if (!activeIndices.includes(idx)) {
                                freeIndex = idx;
                                break;
                            }
                        }
                        state.companyColors[val] = freeIndex;
                    } else {
                        // Remove from active color slots
                        delete state.companyColors[val];
                    }
                    handleCompanyCheckboxChange();
                });
            });
            
            enforceCheckboxLimit();
        }
        
        await loadCloudData();
        
        // Scene with custom background & exponential fog
        cloudScene = new THREE.Scene();
        cloudScene.fog = new THREE.FogExp2(0x04060a, 0.0015);
        
        // Camera configuration
        cloudCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 1500);
        cloudCamera.position.set(0, 220, 420);
        
        // Renderer setup
        cloudRenderer = new THREE.WebGLRenderer({ antialias: true });
        cloudRenderer.setSize(container.clientWidth, container.clientHeight);
        cloudRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        cloudRenderer.setClearColor(0x04060a, 1);
        
        container.appendChild(cloudRenderer.domElement);
        
        // Orbit controls configurations
        cloudControls = new THREE.OrbitControls(cloudCamera, cloudRenderer.domElement);
        cloudControls.enableDamping = true;
        cloudControls.dampingFactor = 0.05;
        cloudControls.maxDistance = 800;
        cloudControls.minDistance = 60;
        
        // Setup group to hold rotated nodes and labels
        cloudGroup = new THREE.Group();
        cloudScene.add(cloudGroup);
        
        rebuildCloudGeometry();
        rebuildCloudLegend();
        
        // Adjust raycasting intersection size threshold
        cloudRaycaster.params.Points.threshold = 3.5;
        
        // Bind Mouse interactions
        container.addEventListener("mousemove", onCloudMouseMove);
        container.addEventListener("mousedown", onCloudMouseDown);
        container.addEventListener("mouseup", onCloudMouseUp);
        container.addEventListener("mouseleave", onCloudMouseLeave);
        
        // Bind Touch interactions for mobile/tablet responsive support
        container.addEventListener("touchstart", onCloudTouchStart, { passive: true });
        container.addEventListener("touchmove", onCloudTouchMove, { passive: true });
        container.addEventListener("touchend", onCloudTouchEnd, { passive: true });
        
        cloudInitialized = true;
        
        if (loader) {
            loader.style.opacity = 0;
            setTimeout(() => {
                loader.style.display = "none";
            }, 500);
        }
        
        animateCloud();
        
    } catch (err) {
        console.error("3D Cloud initialization failed:", err);
        if (loader) {
            loader.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-warning);"></i><h4>WebGL Loading Error</h4><p>${err.message}</p>`;
        }
    }
}

// State togglers for playing/pausing WebGL context to conserve GPU cycles
function startCloud() {
    if (!cloudInitialized) {
        init3DCloud();
    } else {
        if (!cloudAnimationId) {
            animateCloud();
        }
    }
}

function stopCloud() {
    if (cloudAnimationId) {
        cancelAnimationFrame(cloudAnimationId);
        cloudAnimationId = null;
    }
}

// Stub out legacy color updater as the Point Cloud uses its own dynamic checkbox selector
function updateCloudColors() {
}

function animateCloud() {
    if (!cloudScene || !cloudRenderer || !cloudCamera) return;
    cloudAnimationId = requestAnimationFrame(animateCloud);
    
    if (cloudControls) {
        cloudControls.update();
    }
    
    // Slow auto-rotation spin around Y axis
    if (cloudGroup) {
        cloudGroup.rotation.y += 0.0006;
    }
    
    // Check hover state matches
    checkCloudIntersection(false);
    
    cloudRenderer.render(cloudScene, cloudCamera);
}

// Raycaster check and details UI overlay binder
function checkCloudIntersection(isClick = false) {
    if (!cloudPoints || !cloudScene || !cloudCamera) return;
    
    cloudRaycaster.setFromCamera(cloudMouse, cloudCamera);
    const intersects = cloudRaycaster.intersectObject(cloudPoints);
    const tooltip = document.getElementById("cloud-tooltip");
    
    if (intersects.length > 0) {
        const hit = intersects[0];
        const idx = hit.index;
        
        if (cloudHoveredPointIdx !== idx) {
            cloudHoveredPointIdx = idx;
            
            const pointData = cloudDataPoints[idx];
            if (pointData) {
                const [pub, title, domain, company_key, is_affiliate] = pointData;
                
                document.getElementById("tooltip-pub").innerText = pub;
                document.getElementById("tooltip-title").innerText = title;
                
                const formattedDomain = domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                document.getElementById("tooltip-domain").innerText = formattedDomain;
                
                const companyObj = state.companies ? state.companies.find(c => c.key === company_key) : null;
                const compText = companyObj ? companyObj.name : (company_key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()));
                const dotColor = getCompanyColor(company_key).getStyle();
                
                document.getElementById("tooltip-company").innerHTML = `<span class="legend-dot" style="background-color: ${dotColor}"></span> ${compText}`;
            }
        }
        
        // Match tooltip coordinates to screen location
        const container = document.getElementById("canvas-3d-container");
        if (container) {
            const rect = container.getBoundingClientRect();
            const x = cloudMouse.clientX - rect.left;
            const y = cloudMouse.clientY - rect.top;
            
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
            tooltip.classList.add("visible");
        }
        
        // Handle trigger click -> sliding patent information drawer
        if (isClick) {
            const pointData = cloudDataPoints[idx];
            if (pointData) {
                const [pub, title, domain, company_key, is_affiliate] = pointData;
                
                const companyObj = state.companies ? state.companies.find(c => c.key === company_key) : null;
                const compName = companyObj ? companyObj.name : (company_key ? company_key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : "Unknown");
                
                const realNode = {
                    id: `pub_${pub}`,
                    label: pub,
                    title: title || "Patent Publication",
                    country: (pub && pub.length >= 2) ? pub.slice(0, 2).toUpperCase() : "XX",
                    filing_date: null,
                    publication_date: null,
                    kind_code: null,
                    assignee: compName,
                    type: "core",
                    has_text: true
                };
                
                openNodeDetails(realNode, "This patent is visualized in the 3D Domain Cloud. Use the 'Pull Full Description' button below to fetch the detailed specification directly from the database.");
            }
        }
    } else {
        cloudHoveredPointIdx = -1;
        tooltip.classList.remove("visible");
    }
}

// Mouse and Touch coordinates parser
function updateCloudMouseCoords(clientX, clientY) {
    const container = document.getElementById("canvas-3d-container");
    if (!container || !cloudRenderer) return;
    const rect = cloudRenderer.domElement.getBoundingClientRect();
    
    cloudMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    cloudMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    cloudMouse.clientX = clientX;
    cloudMouse.clientY = clientY;
}

function onCloudMouseMove(event) {
    updateCloudMouseCoords(event.clientX, event.clientY);
}

let dragStartX = 0;
let dragStartY = 0;
let dragStartTime = 0;

function onCloudMouseDown(event) {
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartTime = Date.now();
}

function onCloudMouseUp(event) {
    const dist = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
    const duration = Date.now() - dragStartTime;
    // Trigger details only on fast, short clicks to distinguish from drag rotations
    if (dist < 5 && duration < 300) {
        checkCloudIntersection(true);
    }
}

function onCloudMouseLeave() {
    cloudHoveredPointIdx = -1;
    document.getElementById("cloud-tooltip").classList.remove("visible");
}

// Touch controls definitions
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function onCloudTouchStart(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        updateCloudMouseCoords(touch.clientX, touch.clientY);
    }
}

function onCloudTouchMove(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        updateCloudMouseCoords(touch.clientX, touch.clientY);
    }
}

function onCloudTouchEnd(event) {
    const duration = Date.now() - touchStartTime;
    if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        
        if (dist < 10 && duration < 350) {
            updateCloudMouseCoords(touch.clientX, touch.clientY);
            checkCloudIntersection(true);
        }
    }
}

// Auto scale window sizing handler
window.addEventListener("resize", () => {
    if (cloudRenderer && cloudCamera) {
        const container = document.getElementById("canvas-3d-container");
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            cloudCamera.aspect = width / height;
            cloudCamera.updateProjectionMatrix();
            cloudRenderer.setSize(width, height);
        }
    }
});

/* ==========================================================================
   RESEARCH ASSISTANT LIFECYCLE & EVENT HANDLERS
   ========================================================================== */
let researchInterval = null;
let currentResearchTaskId = null;
let renderedLogCount = 0;

function setupResearchAssistant() {
    const queryInput = document.getElementById("research-query-input");
    const clearBtn = document.getElementById("clear-research-query-btn");
    const startBtn = document.getElementById("start-research-btn");
    
    // Clear query input
    queryInput.addEventListener("input", () => {
        clearBtn.style.display = queryInput.value ? "block" : "none";
    });
    
    clearBtn.addEventListener("click", () => {
        queryInput.value = "";
        clearBtn.style.display = "none";
        queryInput.focus();
    });
    
    queryInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !startBtn.disabled) {
            triggerResearchWorkflow();
        }
    });
    
    startBtn.addEventListener("click", triggerResearchWorkflow);
    
    // Setup report tab buttons
    const tabBtns = document.querySelectorAll(".report-tab-btn");
    const tabContents = document.querySelectorAll(".report-tab-content");
    
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-report-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.getAttribute("id") === `report-tab-content-${targetTab}`) {
                    content.classList.add("active");
                }
            });
        });
    });
    
    // Action buttons
    document.getElementById("btn-download-draft").addEventListener("click", () => {
        if (currentResearchTaskId) {
            window.location.href = `/api/research/download/${currentResearchTaskId}/original`;
        }
    });
    
    document.getElementById("btn-download-revised").addEventListener("click", () => {
        if (currentResearchTaskId) {
            window.location.href = `/api/research/download/${currentResearchTaskId}/revised`;
        }
    });
    
    document.getElementById("btn-run-review").addEventListener("click", runReportReview);
}

async function triggerResearchWorkflow() {
    const queryInput = document.getElementById("research-query-input");
    const startBtn = document.getElementById("start-research-btn");
    const query = queryInput.value.trim();
    
    if (!query) return;
    
    // Disable inputs
    queryInput.disabled = true;
    startBtn.disabled = true;
    
    // Reset UI state
    document.getElementById("research-empty-state").style.display = "none";
    document.getElementById("research-layout-container").style.display = "grid";
    
    // Reset progress steps
    resetStepsUI();
    
    // Clear console & previews
    const terminal = document.getElementById("research-terminal-logs");
    terminal.innerHTML = `<div class="terminal-log-line"><span class="timestamp">[SYSTEM]</span> Starting AI research workflow agent session...</div>`;
    document.getElementById("draft-report-preview").innerHTML = ``;
    document.getElementById("revised-report-preview").innerHTML = ``;
    document.getElementById("audit-results-container").innerHTML = ``;
    
    // Hide extra tabs
    document.getElementById("report-tab-btn-revised").style.display = "none";
    document.getElementById("report-tab-btn-audit").style.display = "none";
    
    // Set status badge
    updateWorkflowBadge("running");
    document.getElementById("research-spinner").style.display = "inline-block";
    
    // Call start API
    try {
        const response = await fetch("/api/research/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) throw new Error("Failed to start research task");
        const data = await response.json();
        
        currentResearchTaskId = data.task_id;
        
        // Start polling
        if (researchInterval) clearInterval(researchInterval);
        researchInterval = setInterval(pollWorkflowStatus, 1500);
        
    } catch (err) {
        console.error(err);
        appendTerminalLog("SYSTEM", `Error starting workflow: ${err.message}`, "failed");
        updateWorkflowBadge("failed");
        document.getElementById("research-spinner").style.display = "none";
        queryInput.disabled = false;
        startBtn.disabled = false;
    }
}

async function pollWorkflowStatus() {
    if (!currentResearchTaskId) return;
    
    try {
        const response = await fetch(`/api/research/status/${currentResearchTaskId}`);
        if (!response.ok) throw new Error("Failed to fetch task status");
        
        const task = await response.json();
        
        // Update logs
        renderTerminalLogs(task.logs);
        
        // Update steps based on status
        updateProgressSteps(task);
        
        // Handle completion / failure
        if (task.status === "completed") {
            clearInterval(researchInterval);
            researchInterval = null;
            
            updateWorkflowBadge("completed");
            document.getElementById("research-spinner").style.display = "none";
            
            // Enable query inputs
            document.getElementById("research-query-input").disabled = false;
            document.getElementById("start-research-btn").disabled = false;
            
            // Render report draft
            renderReportDraft(task.report);
            
            appendTerminalLog("SYSTEM", "AI Research Agent workflow completed successfully! Report drafted below.", "success");
            
        } else if (task.status === "failed") {
            clearInterval(researchInterval);
            researchInterval = null;
            
            updateWorkflowBadge("failed");
            document.getElementById("research-spinner").style.display = "none";
            
            document.getElementById("research-query-input").disabled = false;
            document.getElementById("start-research-btn").disabled = false;
            
            appendTerminalLog("SYSTEM", `Workflow failed: ${task.error}`, "failed");
        }
        
    } catch (err) {
        console.error("Polling error:", err);
        appendTerminalLog("SYSTEM", `Error polling status: ${err.message}`);
    }
}

function renderTerminalLogs(logs) {
    const terminal = document.getElementById("research-terminal-logs");
    if (!logs || logs.length === 0) return;
    
    for (let i = renderedLogCount; i < logs.length; i++) {
        const log = logs[i];
        const line = document.createElement("div");
        line.className = "terminal-log-line";
        
        if (log.message.includes("Calling Retrieval") || log.message.includes("Retrieval Agent finished") || log.message.includes("round 2")) {
            line.classList.add("agent-call");
        } else if (log.message.includes("Review Agent") || log.message.includes("HALLUCINATION") || log.message.includes("Patent Hallucination") || log.message.includes("patent numbers")) {
            line.style.color = "#f59e0b";
            line.style.fontWeight = "600";
        } else if (log.message.includes("Running tool") || log.message.includes("execute") || log.message.includes("SQL")) {
            line.classList.add("tool-exec");
        }
        
        const timeStr = log.timestamp ? log.timestamp.substring(11, 19) : new Date().toLocaleTimeString();
        line.innerHTML = `<span class="timestamp">[${timeStr}]</span> ${escapeHtml(log.message)}`;
        terminal.appendChild(line);
    }
    
    renderedLogCount = logs.length;
    terminal.scrollTop = terminal.scrollHeight;
}

function appendTerminalLog(source, message, type = "") {
    const terminal = document.getElementById("research-terminal-logs");
    const line = document.createElement("div");
    line.className = "terminal-log-line";
    if (type === "success") line.style.color = "#10b981";
    if (type === "failed") line.style.color = "#ef4444";
    const timeStr = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="timestamp">[${timeStr}]</span> <strong style="color:var(--accent-blue)">[${source}]</strong> ${escapeHtml(message)}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function updateProgressSteps(task) {
    const stepR1Ret = document.getElementById("step-ind-r1-ret");
    const stepR1Eval = document.getElementById("step-ind-r1-eval");
    const stepR2Ret = document.getElementById("step-ind-r2-ret");
    const stepR2Write = document.getElementById("step-ind-r2-write");
    const circleR2Write = document.getElementById("step-circle-r2-write");
    const textR2Write = document.getElementById("step-text-r2-write");
    
    const steps = [stepR1Ret, stepR1Eval, stepR2Ret, stepR2Write];
    steps.forEach(s => s.classList.remove("active", "completed"));
    
    const step = task.current_step || "";
    const round = task.round || 1;
    
    if (round === 2 || task.round2_evidence || step.includes("Round 2")) {
        stepR2Ret.style.display = "flex";
        circleR2Write.innerText = "4";
        textR2Write.innerText = "Round 2: Final Report";
    } else {
        stepR2Ret.style.display = "none";
        circleR2Write.innerText = "3";
        textR2Write.innerText = "Final Report";
    }
    
    if (task.status === "completed") {
        steps.forEach(s => s.classList.add("completed"));
        return;
    }
    if (task.status === "failed") {
        return;
    }
    
    if (step.includes("Round 1: Retrieving")) {
        stepR1Ret.classList.add("active");
    } else if (step.includes("Round 1: Evaluating")) {
        stepR1Ret.classList.add("completed");
        stepR1Eval.classList.add("active");
    } else if (step.includes("Round 2: Retrieving")) {
        stepR1Ret.classList.add("completed");
        stepR1Eval.classList.add("completed");
        stepR2Ret.classList.add("active");
    } else if (step.includes("Round 2: Writing") || step.includes("Final Report")) {
        stepR1Ret.classList.add("completed");
        stepR1Eval.classList.add("completed");
        if (round === 2) stepR2Ret.classList.add("completed");
        stepR2Write.classList.add("active");
    } else {
        stepR1Ret.classList.add("active");
    }
}

function resetStepsUI() {
    renderedLogCount = 0;
    const stepR2Ret = document.getElementById("step-ind-r2-ret");
    if (stepR2Ret) stepR2Ret.style.display = "none";
    document.getElementById("step-circle-r2-write").innerText = "3";
    document.getElementById("step-text-r2-write").innerText = "Final Report";
    document.getElementById("report-tab-btn-draft").click();
}

function updateWorkflowBadge(status) {
    const badge = document.getElementById("workflow-badge-status");
    badge.innerText = status;
    badge.className = "workflow-badge " + status;
}

function renderMarkdown(markdown) {
    if (!markdown) return "";
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold / Italic
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');
    
    // Code block
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
    
    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = "";
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = "<table>";
            }
            if (line.includes('---')) continue;
            
            const cells = line.split('|').slice(1, -1);
            tableHtml += "tr";
            let rowContent = "";
            cells.forEach(cell => {
                const cellContent = cell.trim();
                const tag = tableHtml.includes('<tr>') || tableHtml.includes('<th>') ? 'td' : 'th';
                rowContent += `<${tag}>${cellContent}</${tag}>`;
            });
            tableHtml += `<tr>${rowContent}</tr>`;
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += "</table>";
                lines[i-1] += "\n" + tableHtml;
                tableHtml = "";
            }
        }
    }
    
    html = lines.join('\n');
    html = html.replace(/^\|.*\|$/gim, '');
    
    // Lists
    html = html.replace(/^\s*\-\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^\s*\*\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<ol><li>$2</li></ol>');
    
    html = html.replace(/<\/ul>\s*<ul>/gim, '');
    html = html.replace(/<\/ol>\s*<ol>/gim, '');
    
    html = html.split('\n').map(line => {
        let l = line.trim();
        if (l && !l.startsWith('<h') && !l.startsWith('<ul') && !l.startsWith('<ol') && !l.startsWith('<li') && !l.startsWith('<pre') && !l.startsWith('<code') && !l.startsWith('<block') && !l.startsWith('<table') && !l.startsWith('<tr') && !l.startsWith('<td') && !l.startsWith('<th') && !l.startsWith('</')) {
            return `<p>${line}</p>`;
        }
        return line;
    }).join('\n');
    
    return html;
}

function renderReportDraft(markdown) {
    const preview = document.getElementById("draft-report-preview");
    preview.innerHTML = renderMarkdown(markdown);
    
    const reviewBtn = document.getElementById("btn-run-review");
    reviewBtn.disabled = false;
    reviewBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Review & Revise (GPT 5.5)`;
}

async function runReportReview() {
    const reviewBtn = document.getElementById("btn-run-review");
    reviewBtn.disabled = true;
    reviewBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Reviewing Report...`;
    
    appendTerminalLog("SYSTEM", "Editor / Auditor Agent invoked. Analyzing draft with GPT 5.5...");
    
    try {
        const response = await fetch("/api/research/review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ task_id: currentResearchTaskId })
        });
        
        if (!response.ok) throw new Error("Failed to review research report");
        const data = await response.json();
        
        const statusResponse = await fetch(`/api/research/status/${currentResearchTaskId}`);
        const task = await statusResponse.json();
        
        document.getElementById("report-tab-btn-revised").style.display = "flex";
        document.getElementById("report-tab-btn-audit").style.display = "flex";
        
        renderRevisedReport(task.revised_report);
        renderAuditResults(task.audit_results);
        
        appendTerminalLog("SYSTEM", "Report successfully audited and revised. See 'Revised Report' and 'Audit Report' tabs.", "success");
        document.getElementById("report-tab-btn-revised").click();
        
    } catch (err) {
        console.error(err);
        appendTerminalLog("SYSTEM", `Review failed: ${err.message}`, "failed");
        reviewBtn.disabled = false;
        reviewBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Review & Revise (GPT 5.5)`;
    }
}

function renderRevisedReport(markdown) {
    const preview = document.getElementById("revised-report-preview");
    preview.innerHTML = renderMarkdown(markdown);
}

function renderAuditResults(results) {
    const container = document.getElementById("audit-results-container");
    if (!results) {
        container.innerHTML = `<p>No audit results available.</p>`;
        return;
    }
    
    const status = results.overall_status || "UNKNOWN";
    const summary = results.executive_summary || "No summary provided.";
    const statusClass = status.toLowerCase().replace(/_/g, '_');
    
    let claimsHtml = "";
    if (results.claim_audit && Array.isArray(results.claim_audit)) {
        results.claim_audit.forEach(item => {
            const itemClass = (item.status || "OK").toLowerCase();
            claimsHtml += `
                <div class="claim-audit-item ${itemClass}">
                    <div class="claim-title-row">
                        <span class="claim-text">${escapeHtml(item.draft_claim || "")}</span>
                        <span class="claim-severity-badge ${itemClass}">${escapeHtml(item.status || "OK")}</span>
                    </div>
                    ${item.issue ? `<div class="claim-issue"><strong>Issue:</strong> ${escapeHtml(item.issue)}</div>` : ''}
                    ${item.recommended_revision ? `<div class="claim-revised"><strong>Revised:</strong> ${escapeHtml(item.recommended_revision)}</div>` : ''}
                </div>
            `;
        });
    }
    
    container.innerHTML = `
        <div class="audit-header">
            <h4>Editor Audit Report</h4>
            <span class="audit-status-badge ${statusClass}">${escapeHtml(status.replace(/_/g, ' '))}</span>
        </div>
        <div class="audit-summary-box">
            <h5>Executive Summary</h5>
            <p>${escapeHtml(summary)}</p>
        </div>
        <div class="claim-audit-list">
            <h5>Claim Audit Log</h5>
            ${claimsHtml || '<p>No claim audits logged.</p>'}
        </div>
    `;
}

