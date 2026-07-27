import { useEffect, useRef, useState, useMemo } from 'react';
import { fetchTechnologyLandscape, fetchAnalytics } from '../data/loaders';
import { LandscapeData } from '../data/types';

// The 5 dynamic neon slot colors matching the local UI
const CLOUD_COLORS_HEX = [
  '#ff007f', // Slot 0: Neon Pink
  '#00d2ff', // Slot 1: Neon Cyan
  '#8b5cf6', // Slot 2: Neon Purple
  '#f59e0b', // Slot 3: Neon Orange
  '#10b981'  // Slot 4: Neon Green
];

// Helper to convert hex to RGB 0-1 for Three.js
function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

const CANONICAL_DOMAINS = [
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

export default function TechnologyLandscape() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [landscapeData, setLandscapeData] = useState<LandscapeData | null>(null);
  const [allCompaniesList, setAllCompaniesList] = useState<Array<{ key: string; name: string }>>([]);
  
  // Selected company keys array (max 5)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  // Slot assignment mapping: { [companyKey]: slotIndex (0..4) }
  const [companyColors, setCompanyColors] = useState<Record<string, number>>({});
  
  const [companySearch, setCompanySearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingCloud, setUpdatingCloud] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Detail drawer state for clicked patent
  const [selectedPatent, setSelectedPatent] = useState<{
    pub: string;
    title: string;
    domain: string;
    companyKey: string;
  } | null>(null);

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

  // 1. Initial startup: load company registry and set initial 5 default selected companies
  useEffect(() => {
    let isMounted = true;
    const initCompanies = async () => {
      try {
        setLoading(true);
        const analytics = await fetchAnalytics();
        const rawCompanies = analytics.companies || [];

        const defaultList = rawCompanies.length > 0 ? rawCompanies.map(c => ({
          key: c.key,
          name: c.name || c.key.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())
        })) : [
          { key: 'loreal', name: "L'Oreal" },
          { key: 'beiersdorf', name: "Beiersdorf AG" },
          { key: 'procter_gamble', name: "The Procter & Gamble Company" },
          { key: 'shiseido', name: "Shiseido Company, Limited" },
          { key: 'unilever', name: "Unilever" }
        ];

        if (!isMounted) return;
        setAllCompaniesList(defaultList);

        // Pick initial top 5 companies
        const initialKeys = defaultList.slice(0, 5).map(c => c.key);
        const initialColors: Record<string, number> = {};
        initialKeys.forEach((key, idx) => {
          initialColors[key] = idx;
        });

        setSelectedCompanies(initialKeys);
        setCompanyColors(initialColors);
      } catch (err: any) {
        console.error('Failed to initialize companies:', err);
        setError('Failed to load company registry.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initCompanies();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch live D1 core patent domain cloud points whenever selectedCompanies changes
  useEffect(() => {
    let isMounted = true;
    if (selectedCompanies.length === 0) {
      setLandscapeData({ domains: CANONICAL_DOMAINS, points: [] });
      return;
    }

    const loadCloudData = async () => {
      setUpdatingCloud(true);
      try {
        const data = await fetchTechnologyLandscape(selectedCompanies);
        if (isMounted) {
          setLandscapeData(data);
        }
      } catch (err) {
        console.error('Failed to update cloud data from D1:', err);
      } finally {
        if (isMounted) setUpdatingCloud(false);
      }
    };

    loadCloudData();
    return () => { isMounted = false; };
  }, [selectedCompanies]);

  // Handle company checkbox toggle with free color slot allocation and max 5 limit
  const handleCompanyToggle = (key: string) => {
    if (selectedCompanies.includes(key)) {
      // Uncheck company: remove from selected list and free its color slot
      const nextSelected = selectedCompanies.filter(k => k !== key);
      const nextColors = { ...companyColors };
      delete nextColors[key];

      setSelectedCompanies(nextSelected);
      setCompanyColors(nextColors);
    } else {
      // Check company: enforce max 5 limit
      if (selectedCompanies.length >= 5) return;

      // Find the first free color slot (0..4)
      const usedSlots = Object.values(companyColors);
      let freeSlot = 0;
      for (let s = 0; s < 5; s++) {
        if (!usedSlots.includes(s)) {
          freeSlot = s;
          break;
        }
      }

      const nextSelected = [...selectedCompanies, key];
      const nextColors = { ...companyColors, [key]: freeSlot };

      setSelectedCompanies(nextSelected);
      setCompanyColors(nextColors);
    }
  };

  // Helper to get color details for a company based on its slot assignment
  const getCompanyColorStyle = (key: string) => {
    const slot = companyColors[key];
    if (slot !== undefined && slot >= 0 && slot < CLOUD_COLORS_HEX.length) {
      return CLOUD_COLORS_HEX[slot];
    }
    return '#4b5563'; // Muted gray fallback
  };

  // Filter company list based on search term
  const filteredCompanyList = useMemo(() => {
    if (!companySearch.trim()) return allCompaniesList;
    const query = companySearch.toLowerCase();
    return allCompaniesList.filter(c => c.name.toLowerCase().includes(query) || c.key.toLowerCase().includes(query));
  }, [allCompaniesList, companySearch]);

  // Legend list sorted by assigned color slot index (0..4)
  const sortedLegendList = useMemo(() => {
    return selectedCompanies
      .map(key => {
        const companyObj = allCompaniesList.find(c => c.key === key);
        return {
          key,
          name: companyObj ? companyObj.name : key.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase()),
          slot: companyColors[key] ?? 999,
          color: getCompanyColorStyle(key)
        };
      })
      .sort((a, b) => a.slot - b.slot);
  }, [selectedCompanies, companyColors, allCompaniesList]);

  // 3. Build Three.js 3D Viewport Scene
  useEffect(() => {
    const THREE = (window as any).THREE;
    if (!THREE || !containerRef.current || !landscapeData) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // Clear previous elements inside container
    container.innerHTML = '';

    // Initialize Scene, Fog & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060a);
    scene.fog = new THREE.FogExp2(0x04060a, 0.0015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1500);
    camera.position.set(0, 220, 420);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x04060a, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const OrbitControls = THREE.OrbitControls;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 800;
    controls.minDistance = 60;
    controlsRef.current = controls;

    // Group to hold particles and domain billboard labels
    const pointsGroup = new THREE.Group();
    scene.add(pointsGroup);
    pointsGroupRef.current = pointsGroup;

    // Canonical 9 domains centers in radial layout
    const domains = CANONICAL_DOMAINS;
    const domainCenters: Record<string, any> = {};

    domains.forEach((dom, idx) => {
      const theta = (idx / domains.length) * Math.PI * 2;
      const r = 180;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = 35 * Math.sin(theta * 3);
      domainCenters[dom] = new THREE.Vector3(x, y, z);

      // Create text label billboard pill
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(11, 16, 27, 0.82)';
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
        ctx.lineWidth = 4;

        const bx = 8, by = 8, bw = canvas.width - 16, bh = canvas.height - 16, br = 20;
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bw - br, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
        ctx.lineTo(bx + bw, by + bh - br);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
        ctx.lineTo(bx + br, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Inter, Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const formatted = dom.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        ctx.fillText(formatted, canvas.width / 2, canvas.height / 2);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(64, 16, 1);
      sprite.position.set(x, y + 42, z);
      pointsGroup.add(sprite);
    });

    // Radial gradient texture for glowing particle dots
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 64, 64);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    // Points metadata & positioning
    const filteredPoints = landscapeData.points.filter(p => selectedCompanies.includes(p[3]));
    allPointsMetaRef.current = filteredPoints;

    const numPoints = filteredPoints.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    // Seeded random helper for stable point clustering
    let seed = 12345;
    const rand = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < numPoints; i++) {
      const [_pub, _title, domain, companyKey] = filteredPoints[i];
      let center = new THREE.Vector3(0, 0, 0);
      if (domainCenters[domain]) {
        center = domainCenters[domain];
      }

      const rSpread = 32;
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

      const hex = getCompanyColorStyle(companyKey);
      const rgb = hexToRgb(hex);
      colors[i * 3] = rgb.r;
      colors[i * 3 + 1] = rgb.g;
      colors[i * 3 + 2] = rgb.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 2.4,
      map: pTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    const pointCloud = new THREE.Points(geometry, pointMaterial);
    pointsGroup.add(pointCloud);
    pointsRef.current = pointCloud;

    // Animation loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Passive Y rotation spin
      pointsGroup.rotation.y += 0.0006;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Raycaster interaction
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 3.5;
    const mouse = new THREE.Vector2();

    const updateMouseCoords = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onMouseMove = (event: MouseEvent) => {
      const pos = updateMouseCoords(event.clientX, event.clientY);
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(pointCloud);
      const tooltip = tooltipRef.current;

      if (intersects.length > 0) {
        const index = intersects[0].index;
        if (index !== undefined && index >= 0 && index < allPointsMetaRef.current.length && tooltip) {
          const [pub, title, domain, companyKey] = allPointsMetaRef.current[index];
          const companyObj = allCompaniesList.find(c => c.key === companyKey);
          const compName = companyObj ? companyObj.name : companyKey.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase());
          const hexColor = getCompanyColorStyle(companyKey);
          const formattedDomain = domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

          tooltip.classList.add('visible');
          tooltip.style.left = `${pos.x + 12}px`;
          tooltip.style.top = `${pos.y - 12}px`;
          tooltip.innerHTML = `
            <h4 style="color:var(--text-bright); font-size:0.9rem; font-weight:700;">${pub}</h4>
            <p style="font-size:0.78rem; color:var(--text-secondary); margin:4px 0;">${title}</p>
            <span style="font-size:0.72rem; color:var(--accent-blue);">${formattedDomain}</span>
            <div style="margin-top:6px; font-size:0.78rem; font-weight:600; color:${hexColor}; display:flex; align-items:center; gap:6px;">
              <span style="width:8px; height:8px; border-radius:50%; background-color:${hexColor}; display:inline-block;"></span>
              ${compName}
            </div>
          `;
        }
      } else {
        if (tooltip) tooltip.classList.remove('visible');
      }
    };

    let dragStartX = 0, dragStartY = 0, dragTime = 0;
    const onMouseDown = (e: MouseEvent) => {
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragTime = Date.now();
    };

    const onMouseUp = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      const duration = Date.now() - dragTime;
      if (dist < 5 && duration < 300) {
        updateMouseCoords(e.clientX, e.clientY);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(pointCloud);
        if (intersects.length > 0) {
          const index = intersects[0].index;
          if (index !== undefined && index >= 0 && index < allPointsMetaRef.current.length) {
            const [pub, title, domain, companyKey] = allPointsMetaRef.current[index];
            setSelectedPatent({ pub, title, domain, companyKey });
          }
        }
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
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
        rendererRef.current.domElement.removeEventListener('mousedown', onMouseDown);
        rendererRef.current.domElement.removeEventListener('mouseup', onMouseUp);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (controlsRef.current) controlsRef.current.dispose();
      if (rendererRef.current) rendererRef.current.dispose();
      pointCloud.geometry.dispose();
      (pointCloud.material as any).dispose();
      pointsGroup.children.forEach((c: any) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      container.innerHTML = '';
    };
  }, [landscapeData, selectedCompanies, companyColors, allCompaniesList]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px', color: 'var(--accent-blue)' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginRight: '12px' }}></i>
        <span>Initializing 3D Patent Domain Cloud Engine...</span>
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

  const visiblePointsCount = allPointsMetaRef.current.length;

  return (
    <section className="tab-content active" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Panel Header */}
      <div className="cloud-panel" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '20px 24px', borderRadius: 'var(--border-radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-bright)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-cube" style={{ color: 'var(--accent-blue)' }}></i> 3D Patent Domain Cloud
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
                {updatingCloud ? 'Updating D1 Cloud...' : `${visiblePointsCount.toLocaleString()} Core Patent Dots`}
              </span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Interactive 3D particle visualization of core patents clustered inside technology domains. Color-coded by company.
            </p>
          </div>
          
          <div style={{ fontSize: '0.8rem', color: selectedCompanies.length >= 5 ? 'var(--color-warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
            {selectedCompanies.length} of 5 Companies Selected
          </div>
        </div>

        {/* Company Selector Checkbox Grid (Max 5 enforced) */}
        <div className="cloud-company-selector" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <span className="selector-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-solid fa-filter" style={{ color: 'var(--accent-blue)', marginRight: '6px' }}></i> Display Companies (Select up to 5):
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', 
              gap: '8px',
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '10px',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)'
            }}
          >
            {filteredCompanyList.map((company) => {
              const isChecked = selectedCompanies.includes(company.key);
              const isDisabled = !isChecked && selectedCompanies.length >= 5;
              const dotColor = isChecked ? getCompanyColorStyle(company.key) : '#4b5563';

              return (
                <label 
                  key={company.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.78rem', 
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    padding: '5px 10px',
                    background: isChecked ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: '1px solid',
                    borderColor: isChecked ? dotColor : 'transparent',
                    borderRadius: '14px',
                    color: isChecked ? 'var(--text-bright)' : (isDisabled ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)'),
                    opacity: isDisabled ? 0.45 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input 
                    type="checkbox" 
                    value={company.key}
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => handleCompanyToggle(company.key)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ width: '9px', height: '9px', backgroundColor: dotColor, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company.name}</span>
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
        {/* Three.js Canvas Container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>

        {/* Dynamic Overlay Company Color Legend System (Matching Local UI) */}
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
            width: '210px',
            zIndex: 10
          }}
        >
          <div className="cloud-legend-title" style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-tags" style={{ color: 'var(--accent-blue)' }}></i> Company Color Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sortedLegendList.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)' }}>No companies selected</span>
            ) : (
              sortedLegendList.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '9px', height: '9px', backgroundColor: item.color, borderRadius: '50%', flexShrink: 0 }}></span>
                  <span style={{ color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3D Navigation Instructions Overlay */}
        <div className="cloud-instructions-overlay" style={{ position: 'absolute', bottom: '15px', right: '15px', background: 'rgba(7, 10, 17, 0.88)', padding: '12px 14px', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none', zIndex: 10 }}>
          <div className="instruction-title" style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '2px' }}>
            <i className="fa-solid fa-hand-pointer"></i> Navigation Controls
          </div>
          <div><i className="fa-solid fa-arrows-spin" style={{ marginRight: '6px' }}></i> Drag Mouse: Spin Cloud</div>
          <div><i className="fa-solid fa-arrows-up-down" style={{ marginRight: '6px' }}></i> Scroll Wheel: Zoom In/Out</div>
          <div><i className="fa-solid fa-up-down-left-right" style={{ marginRight: '6px' }}></i> Right Click + Drag: Pan Camera</div>
          <div><i className="fa-solid fa-arrow-pointer" style={{ marginRight: '6px' }}></i> Hover Dot: Show Patent Info</div>
          <div><i className="fa-solid fa-object-group" style={{ marginRight: '6px' }}></i> Click Dot: Pull Patent Drawer</div>
        </div>

        {/* Hover Tooltip */}
        <div ref={tooltipRef} className="cloud-tooltip"></div>
      </div>

      {/* Detail Drawer Modal for Clicked Patent Dot */}
      {selectedPatent && (
        <div style={{ position: 'fixed', right: '20px', bottom: '20px', width: '360px', background: 'rgba(11, 16, 27, 0.95)', border: '1px solid var(--accent-blue)', borderRadius: '12px', padding: '18px', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ background: 'rgba(0,210,255,0.15)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              {selectedPatent.pub}
            </span>
            <button onClick={() => setSelectedPatent(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-bright)', marginBottom: '8px' }}>{selectedPatent.title}</h4>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <strong>Domain:</strong> {selectedPatent.domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </div>
          <div style={{ fontSize: '0.78rem', color: getCompanyColorStyle(selectedPatent.companyKey), fontWeight: 600 }}>
            <strong>Assignee:</strong> {allCompaniesList.find(c => c.key === selectedPatent.companyKey)?.name || selectedPatent.companyKey}
          </div>
        </div>
      )}

    </section>
  );
}
