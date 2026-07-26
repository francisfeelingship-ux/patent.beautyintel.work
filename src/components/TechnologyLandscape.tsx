import { useEffect, useRef, useState, useMemo } from 'react';
import { fetchTechnologyLandscape } from '../data/loaders';
import { LandscapeData } from '../data/types';

const COMPANY_COLORS: Record<string, { r: number; g: number; b: number; hex: string; name: string }> = {
  'loreal': { r: 0.0, g: 0.82, b: 1.0, hex: '#00d2ff', name: "L'Oreal" }, // Cyan
  'beiersdorf': { r: 0.54, g: 0.36, b: 0.96, hex: '#8b5cf6', name: "Beiersdorf AG" }, // Purple
  'shiseido': { r: 0.92, g: 0.28, b: 0.6, hex: '#ec4899', name: "Shiseido Company, Limited" }, // Pink
  'procter_gamble': { r: 0.23, g: 0.51, b: 0.96, hex: '#3b82f6', name: "The Procter & Gamble Company" }, // Blue
  'unilever': { r: 0.06, g: 0.72, b: 0.5, hex: '#10b981', name: "Unilever" }, // Greenish Surfactant/Teal
  'estee_lauder': { r: 0.96, g: 0.62, b: 0.04, hex: '#f59e0b', name: "The Estee Lauder Companies Inc." },
  'revlon': { r: 0.94, g: 0.27, b: 0.27, hex: '#ef4444', name: "Revlon" },
  'kenvue': { r: 0.02, g: 0.71, b: 0.83, hex: '#06b6d4', name: "Kenvue" },
  'colgate_palmolive': { r: 0.39, g: 0.4, b: 0.95, hex: '#6366f1', name: "Colgate-Palmolive Company" },
  'amorepacific': { r: 0.66, g: 0.33, b: 0.97, hex: '#a855f7', name: "Amorepacific" },
  'givaudan': { r: 0.08, g: 0.72, b: 0.65, hex: '#14b8a6', name: "Givaudan" },
  'kao_corp': { r: 0.96, g: 0.25, b: 0.37, hex: '#f43f5e', name: "Kao Corp" },
  'symrise': { r: 0.98, g: 0.75, b: 0.14, hex: '#fbbf24', name: "Symrise" },
  'evonik': { r: 0.2, g: 0.83, b: 0.6, hex: '#34d399', name: "Evonik" },
  'henkel': { r: 0.38, g: 0.65, b: 0.98, hex: '#60a5fa', name: "Henkel" },
  'firmenich': { r: 0.75, g: 0.52, b: 0.99, hex: '#c084fc', name: "Firmenich" },
  'dsm': { r: 0.96, g: 0.45, b: 0.71, hex: '#f472b6', name: "DSM" },
  'dow': { r: 0.13, g: 0.83, b: 0.93, hex: '#22d3ee', name: "Dow" },
  'seppic': { r: 0.51, g: 0.55, b: 0.97, hex: '#818cf8', name: "Seppic" },
  'basf': { r: 0.65, g: 0.95, b: 0.82, hex: '#a7f3d0', name: "BASF" },
  'coty': { r: 0.98, g: 0.81, b: 0.91, hex: '#fbcfe8', name: "Coty" },
  'cosmax': { r: 0.99, g: 0.94, b: 0.54, hex: '#fef08a', name: "Cosmax" },
  'croda': { r: 0.75, g: 0.52, b: 0.99, hex: '#c084fc', name: "Croda" },
  'intercos': { r: 0.99, g: 0.64, b: 0.69, hex: '#fda4af', name: "Intercos" },
  'ashland': { r: 0.65, g: 0.95, b: 0.99, hex: '#a5f3fc', name: "Ashland" }
};

// Helper for dynamic company color assignment if an unlisted company key appears
const getCompanyColorDetails = (key: string) => {
  if (COMPANY_COLORS[key]) return COMPANY_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const hex = `hsl(${h}, 70%, 60%)`;
  const name = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { r: 0.5, g: 0.7, b: 0.9, hex, name };
};

export default function TechnologyLandscape() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  
  const [landscapeData, setLandscapeData] = useState<LandscapeData | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Three.js instances stored in refs
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const pointsGroupRef = useRef<any>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  // Point cloud details for Raycasting
  const pointsRef = useRef<any>(null);
  const allPointsMetaRef = useRef<Array<[string, string, string, string, number]>>([]);

  // Load points dataset
  useEffect(() => {
    const getData = async () => {
      try {
        const data = await fetchTechnologyLandscape();
        setLandscapeData(data);
        // Extract all company keys dynamically and select all by default
        const allKeys = Array.from(new Set(data.points.map(p => p[3])));
        setSelectedCompanies(allKeys);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load technology landscape visualization data.');
      } finally {
        setLoading(false);
      }
    };
    getData();
  }, []);

  // Compute available company list dynamically
  const availableCompanies = useMemo(() => {
    if (!landscapeData) return [];
    const keys = Array.from(new Set(landscapeData.points.map(p => p[3])));
    return keys.map(key => ({
      key,
      ...getCompanyColorDetails(key)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [landscapeData]);

  // Filtered company list based on search term
  const filteredCompanyList = useMemo(() => {
    if (!companySearch.trim()) return availableCompanies;
    const query = companySearch.toLowerCase();
    return availableCompanies.filter(c => c.name.toLowerCase().includes(query) || c.key.toLowerCase().includes(query));
  }, [availableCompanies, companySearch]);

  const handleCompanyToggle = (companyKey: string) => {
    setSelectedCompanies(prev => {
      if (prev.includes(companyKey)) {
        if (prev.length <= 1) return prev; // Enforce at least 1 checked
        return prev.filter(c => c !== companyKey);
      } else {
        return [...prev, companyKey];
      }
    });
  };

  const handleSelectAll = () => {
    if (!landscapeData) return;
    const allKeys = Array.from(new Set(landscapeData.points.map(p => p[3])));
    setSelectedCompanies(allKeys);
  };

  const handleDeselectAll = () => {
    if (availableCompanies.length > 0) {
      // Keep top company selected
      setSelectedCompanies([availableCompanies[0].key]);
    }
  };

  // Build and manage Three.js Scene
  useEffect(() => {
    const THREE = (window as any).THREE;
    if (!THREE || !containerRef.current || !landscapeData) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Initialize Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.0015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 220, 520);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Initialize Controls
    const OrbitControls = THREE.OrbitControls;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 900;
    controls.minDistance = 80;
    controlsRef.current = controls;

    // 3. Create Group for points
    const pointsGroup = new THREE.Group();
    scene.add(pointsGroup);
    pointsGroupRef.current = pointsGroup;

    // 4. Set up domains and their centers
    const formatDomain = (d: string) => d.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    const domainCenters: Record<string, any> = {};
    const domains = landscapeData.domains;
    
    // Create domain text billboards / centers in a circle
    domains.forEach((dom, idx) => {
      const theta = (idx / domains.length) * Math.PI * 2;
      const r = 185;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = 35 * Math.sin(theta * 3);
      domainCenters[dom] = new THREE.Vector3(x, y, z);

      // Create text label billboard
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(7, 9, 14, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 256, 64);

        ctx.font = 'bold 15px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatDomain(dom), 128, 32);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(72, 18, 1);
      sprite.position.set(x, y + 42, z);
      pointsGroup.add(sprite);
    });

    // 5. Filter and Draw points
    const filteredPoints = landscapeData.points.filter(p => selectedCompanies.includes(p[3]));
    allPointsMetaRef.current = filteredPoints;

    const numPoints = filteredPoints.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    // Create simple circular point texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const gradient = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pCtx.fillStyle = gradient;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    // Distribute points in clusters around domain centers (seeded random so they remain fixed)
    let s = 999;
    const rand = () => {
      const x = Math.sin(s++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < numPoints; i++) {
      const [_pub, _title, domain, companyKey] = filteredPoints[i];
      let center = new THREE.Vector3(0, 0, 0);
      if (domainCenters[domain]) {
        center = domainCenters[domain];
      }

      // Spherical random offset
      const rSpread = 36;
      const u = rand();
      const v = rand();
      const w = rand();
      
      const r = rSpread * Math.cbrt(u);
      const phi = Math.acos(2 * v - 1);
      const theta = Math.PI * 2 * w;
      
      const dx = r * Math.sin(phi) * Math.cos(theta);
      const dy = r * Math.sin(phi) * Math.sin(theta);
      const dz = r * Math.cos(phi);

      positions[i * 3] = center.x + dx;
      positions[i * 3 + 1] = center.y + dy;
      positions[i * 3 + 2] = center.z + dz;

      // Color from company details
      const cColor = getCompanyColorDetails(companyKey);
      colors[i * 3] = cColor.r;
      colors[i * 3 + 1] = cColor.g;
      colors[i * 3 + 2] = cColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 3.6,
      map: pTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    const pointCloud = new THREE.Points(geometry, pointMaterial);
    pointsGroup.add(pointCloud);
    pointsRef.current = pointCloud;

    // 6. Animation loop
    let angle = 0;
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Slow passive rotation
      angle += 0.0005;
      pointsGroup.rotation.y = angle;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 7. Raycaster / Mouse Interaction
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 4.0;
    const mouse = new THREE.Vector2();
    const tooltip = tooltipRef.current;

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObject(pointCloud);

      if (intersects.length > 0) {
        const index = intersects[0].index;
        if (index !== undefined && index >= 0 && index < allPointsMetaRef.current.length && tooltip) {
          const [pub, title, domain, companyKey, famSize] = allPointsMetaRef.current[index];
          const companyDetails = getCompanyColorDetails(companyKey);
          
          tooltip.classList.add('visible');
          tooltip.style.left = (event.clientX - rect.left + 15) + 'px';
          tooltip.style.top = (event.clientY - rect.top - 15) + 'px';
          tooltip.innerHTML = `
            <h4>${pub} <span style="font-size:0.7rem; font-weight:normal; opacity:0.8; margin-left:6px;">(${famSize || 1} family members)</span></h4>
            <p>${title}</p>
            <span>${formatDomain(domain)}</span>
            <div style="color:${companyDetails.hex}; font-weight:600;">${companyDetails.name}</div>
          `;
        }
      } else {
        if (tooltip) tooltip.classList.remove('visible');
      }
    };

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      pointCloud.geometry.dispose();
      (pointCloud.material as any).dispose();
      pointsGroup.children.forEach((c: any) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      container.innerHTML = '';
    };
  }, [landscapeData, selectedCompanies]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--accent-blue)' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginRight: '10px' }}></i>
        <span>Loading technology landscape dots (23,361 patent parent families)...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px', color: 'var(--color-warning)', textAlign: 'center' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
        <p>{error}</p>
      </div>
    );
  }

  const totalPoints = landscapeData ? landscapeData.points.length : 0;
  const visiblePointsCount = allPointsMetaRef.current.length;

  return (
    <section className="tab-content active" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Panel header details */}
      <div className="cloud-panel" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '20px 24px', borderRadius: 'var(--border-radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-cube" style={{ color: 'var(--accent-blue)' }}></i> 3D Technology Landscape
              <span 
                style={{ 
                  background: 'rgba(0, 210, 255, 0.12)', 
                  border: '1px solid rgba(0, 210, 255, 0.3)', 
                  color: 'var(--accent-blue)', 
                  fontSize: '0.78rem', 
                  padding: '3px 10px', 
                  borderRadius: '12px',
                  fontWeight: 600
                }}
              >
                {visiblePointsCount.toLocaleString()} / {totalPoints.toLocaleString()} Parent Family Dots
              </span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Interactive 3D cluster representing 100% of global cosmetic patent parent families across all company portfolios.
            </p>
          </div>
          
          {/* Quick Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleSelectAll}
              style={{
                background: 'rgba(0, 210, 255, 0.12)',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                color: 'var(--text-bright)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-check-double"></i> Select All Companies ({availableCompanies.length})
            </button>
            <button 
              onClick={handleDeselectAll}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-xmark"></i> Clear Filters
            </button>
          </div>
        </div>

        {/* Company filter list & search */}
        <div className="cloud-company-selector" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <span className="selector-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-solid fa-filter" style={{ color: 'var(--accent-blue)', marginRight: '6px' }}></i> Filter Company Portfolios ({selectedCompanies.length} selected of {availableCompanies.length}):
            </span>
            
            <div style={{ position: 'relative', width: '220px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}></i>
              <input 
                type="text" 
                placeholder="Search company..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 10px 5px 28px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '14px',
                  color: 'var(--text-bright)',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div 
            className="company-checkboxes" 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '8px',
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '10px',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)'
            }}
          >
            {filteredCompanyList.map((details) => {
              const isSelected = selectedCompanies.includes(details.key);
              return (
                <label 
                  key={details.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.78rem', 
                    cursor: 'pointer',
                    padding: '5px 10px',
                    background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: '1px solid',
                    borderColor: isSelected ? details.hex : 'transparent',
                    borderRadius: '14px',
                    color: isSelected ? 'var(--text-bright)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input 
                    type="checkbox" 
                    value={details.key}
                    checked={isSelected}
                    onChange={() => handleCompanyToggle(details.key)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ width: '9px', height: '9px', backgroundColor: details.hex, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{details.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Viewport Card */}
      <div 
        className="cloud-viewport-container" 
        style={{ 
          position: 'relative', 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-md)',
          height: '560px',
          overflow: 'hidden'
        }}
      >
        {/* Three.js canvas container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>

        {/* Legend overlay */}
        <div 
          className="cloud-legend-overlay" 
          style={{ 
            position: 'absolute', 
            top: '15px', 
            left: '15px', 
            background: 'rgba(7, 10, 17, 0.88)', 
            padding: '12px 14px', 
            border: '1px solid var(--glass-border)', 
            borderRadius: '8px', 
            fontSize: '0.72rem',
            maxHeight: '220px',
            overflowY: 'auto',
            width: '210px'
          }}
        >
          <div className="cloud-legend-title" style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-tags" style={{ color: 'var(--accent-blue)' }}></i> Company Color Legend ({selectedCompanies.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {availableCompanies.filter(c => selectedCompanies.includes(c.key)).map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: c.hex, borderRadius: '50%', flexShrink: 0 }}></span>
                <span style={{ color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation instructions */}
        <div className="cloud-instructions-overlay" style={{ position: 'absolute', bottom: '15px', right: '15px', background: 'rgba(7, 10, 17, 0.88)', padding: '12px 14px', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none' }}>
          <div className="instruction-title" style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '2px' }}>
            <i className="fa-solid fa-hand-pointer"></i> 3D Navigation Controls
          </div>
          <div><i className="fa-solid fa-arrows-spin" style={{ marginRight: '6px' }}></i> Left Click + Drag: Rotate Cloud</div>
          <div><i className="fa-solid fa-arrows-up-down" style={{ marginRight: '6px' }}></i> Scroll Wheel: Zoom In/Out</div>
          <div><i className="fa-solid fa-up-down-left-right" style={{ marginRight: '6px' }}></i> Right Click + Drag: Pan View</div>
          <div><i className="fa-solid fa-arrow-pointer" style={{ marginRight: '6px' }}></i> Hover Point: Inspect Parent Family</div>
        </div>

        {/* Tooltip element */}
        <div 
          ref={tooltipRef} 
          className="cloud-tooltip" 
        ></div>
      </div>

    </section>
  );
}
