'use client';

import React, { useState, useEffect, useRef } from 'react';

const BLOB_BASE = 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com';

interface CatalogItem {
  id: number;
  name: string;
  url: string;
  category: string;
  tags: string[];
  size: string;
  uploadedAt: string;
}

const CATALOG_ITEMS: CatalogItem[] = [
  { id: 1, name: 'Mechanical Keyboard', url: `${BLOB_BASE}/electronics/mechanical-keyboard-1768366050152-uB9sdebxEqtXAE5ySxGPopefn7HLBN.glb`, category: 'electronics', tags: ['keyboard', 'mechanical', 'tech'], size: '30.1 MB', uploadedAt: '2026-01-14' },
  { id: 2, name: 'Battery Energy Drink', url: `${BLOB_BASE}/kitchen/battery-energy-drink-1768364798401-5JqO78AiCwAQm7Y1W9VT1RkcKmpzYe.glb`, category: 'kitchen', tags: ['drink', 'can', 'energy'], size: '3.9 MB', uploadedAt: '2026-01-14' },
  { id: 3, name: 'Camel Cigarette Pack', url: `${BLOB_BASE}/personal/camel-cigarette-pack-1768363441889-J5EEUIgRekBSD0oIuJEfMrKkQjw90u.glb`, category: 'personal', tags: ['cigarettes', 'camel', 'pack'], size: '4.6 MB', uploadedAt: '2026-01-14' },
  { id: 4, name: 'Cigarette Pack', url: `${BLOB_BASE}/personal/cigarette-pack-1768360298495-x3Nx8mURa51kxNCifbT6qPzyWbomNz.glb`, category: 'personal', tags: ['cigarettes', 'pack'], size: '45.9 MB', uploadedAt: '2026-01-14' },
  { id: 5, name: 'Cigarette Pack Alt', url: `${BLOB_BASE}/personal/cigarette-pack-1768362263788-QaNdHbPUQups26NpmO6fkS3tuXCxrP.glb`, category: 'personal', tags: ['cigarettes', 'pack'], size: '45.9 MB', uploadedAt: '2026-01-14' },
  { id: 6, name: 'Bobblehead Figurine', url: `${BLOB_BASE}/toys/man-bobblehead-figurine-1768365190007-S7dL4VU4sbK0jul3l6ZEhSZwjTaOyu.glb`, category: 'toys', tags: ['figurine', 'bobblehead', 'toy'], size: '2.4 MB', uploadedAt: '2026-01-14' }
];

type GridSize = 'xs' | 'sm' | 'md' | 'lg';

function ModelCard({ item, onClick, index }: { item: CatalogItem; onClick: () => void; gridSize: GridSize; index: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cleanup = () => {};
    let animId: number | undefined;
    
    const loadViewer = async () => {
      if (!containerRef.current) return;
      
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      
      const container = containerRef.current;
      const size = container.clientWidth || 150;
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xefefef);
      
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
      camera.position.set(2.5, 1.8, 2.5);
      camera.lookAt(0, 0, 0);
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const key = new THREE.DirectionalLight(0xffffff, 1);
      key.position.set(5, 8, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-5, 2, -5);
      scene.add(fill);
      
      const loader = new GLTFLoader();
      let angle = Math.random() * Math.PI * 2;
      
      loader.load(item.url, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const s = box.getSize(new THREE.Vector3());
        const c = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(s.x, s.y, s.z);
        const scale = 1.8 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(c.multiplyScalar(scale));
        scene.add(model);
        setLoading(false);
        
        function animate() {
          angle += 0.006;
          model.rotation.y = angle;
          renderer.render(scene, camera);
          animId = requestAnimationFrame(animate);
        }
        animate();
      }, undefined, () => {
        setError(true);
        setLoading(false);
      });
      
      cleanup = () => {
        if (animId) cancelAnimationFrame(animId);
        renderer.dispose();
      };
    };
    
    const timer = setTimeout(loadViewer, index * 150);
    return () => { clearTimeout(timer); cleanup(); };
  }, [item.url, index]);

  return (
    <button
      onClick={onClick}
      className="aspect-square bg-[#efefef] rounded-[3px] overflow-hidden border-none cursor-pointer p-0 relative transition-all duration-150 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#efefef] z-[1]">
          <div className="w-5 h-5 border-2 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-[#888]">
          {item.name}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </button>
  );
}

export default function KatalogViewer() {
  const [items] = useState(CATALOG_ITEMS);
  const [filteredItems, setFilteredItems] = useState(CATALOG_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridSize, setGridSize] = useState<GridSize>('md');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  useEffect(() => {
    let filtered = [...items];
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    setFilteredItems(filtered);
  }, [items, selectedCategory, searchQuery]);

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))];
  const tags = ['all', ...Array.from(new Set(items.flatMap(i => i.tags)))];
  const sizes: GridSize[] = ['xs', 'sm', 'md', 'lg'];

  const gridClasses: Record<GridSize, string> = {
    xs: 'grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-[3px]',
    sm: 'grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1',
    md: 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1.5',
    lg: 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2'
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] font-sans">
      <header className="sticky top-0 z-50 bg-[#f8f8f8] border-b border-[#e5e5e5]">
        <div className="px-4 pt-3 pb-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium tracking-wide">katalog</span>
            <span className="text-[11px] text-[#888]">{filteredItems.length} of {items.length} objects</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            <span className="text-[#888] mr-0.5">Filter:</span>
            {categories.map((cat, i) => (
              <React.Fragment key={cat}>
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className={`bg-transparent border-none cursor-pointer underline underline-offset-2 px-1 py-0.5 font-sans text-[11px] ${selectedCategory === cat ? 'font-medium' : 'font-normal'}`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
                {i < categories.length - 1 && <span className="text-[#ccc]">|</span>}
              </React.Fragment>
            ))}
            <button
              onClick={() => setGridSize(sizes[(sizes.indexOf(gridSize) + 1) % sizes.length])}
              className="ml-auto bg-transparent border-none cursor-pointer underline underline-offset-2 px-1.5 py-0.5 font-sans text-[11px]"
            >
              Change size
            </button>
          </div>
        </div>
        <div className="px-4 pb-2.5">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search objects..."
            className="w-full py-2 px-3 text-xs border border-[#e5e5e5] rounded-lg bg-white outline-none font-sans focus:border-[#888]"
          />
        </div>
      </header>

      <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => setSearchQuery(tag === 'all' ? '' : tag)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-2xl border whitespace-nowrap cursor-pointer font-sans flex-shrink-0 transition-colors ${
              (searchQuery === tag || (tag === 'all' && !searchQuery))
                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                : 'bg-white text-[#1a1a1a] border-[#e5e5e5] hover:bg-[#f0f0f0]'
            }`}
          >
            {tag === 'all' ? 'Show All' : tag}
          </button>
        ))}
      </div>

      <div className="px-3 pb-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-[#888]">
            <p className="font-medium mb-1">No objects found</p>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          <div className={`grid ${gridClasses[gridSize]}`}>
            {filteredItems.map((item, index) => (
              <ModelCard key={item.id} item={item} onClick={() => setSelectedItem(item)} gridSize={gridSize} index={index} />
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4"
        >
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="aspect-square bg-[#efefef] relative flex items-center justify-center">
              <button 
                onClick={() => setSelectedItem(null)} 
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 border-none cursor-pointer text-lg flex items-center justify-center hover:scale-110 transition-transform"
              >
                ×
              </button>
              <div className="text-[#888] text-center">
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mx-auto mb-2 opacity-50">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-xs">3D Model</span>
                <p className="text-[10px] mt-2 opacity-60">Open HTML version for interactive 3D</p>
              </div>
              <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[9px] text-black/35">Drag to rotate • Pinch to zoom</span>
            </div>
            <div className="p-4 overflow-y-auto">
              <h2 className="text-base font-medium mb-1">{selectedItem.name}</h2>
              <p className="text-[11px] text-[#888] mb-3">{selectedItem.category}</p>
              <div className="text-[11px] text-[#888] mb-3">
                <span className="mr-4">Size: {selectedItem.size}</span>
                <span>Uploaded: {selectedItem.uploadedAt}</span>
              </div>
              {selectedItem.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedItem.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-[#f0f0f0] rounded-[10px] text-[9px]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
