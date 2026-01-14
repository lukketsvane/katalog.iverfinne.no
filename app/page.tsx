'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CatalogItem {
  url: string;
  pathname: string;
  name: string;
  category: string;
  size?: number;
  uploadedAt?: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'furniture/chairs', label: 'Chairs' },
  { value: 'furniture/tables', label: 'Tables' },
  { value: 'furniture/lamps', label: 'Lamps' },
  { value: 'furniture/storage', label: 'Storage' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'toys', label: 'Toys' },
  { value: 'tools', label: 'Tools' },
  { value: 'art', label: 'Art' },
  { value: 'personal', label: 'Personal' },
  { value: 'misc', label: 'Misc' },
];

// Models that should not open in the overlay window
const IGNORED_MODELS = ['Sculpt5', 'Sculpt9'];
const IGNORED_CATEGORY = 'models';

// Viewer configuration constants
const MODEL_SCALE_FACTOR = 2.5;
const CAMERA_DISTANCE_MULTIPLIER = 1.2;
const CAMERA_HEIGHT_MULTIPLIER = 0.7;

function shouldIgnoreItem(item: CatalogItem): boolean {
  return (
    item.category.toLowerCase() === IGNORED_CATEGORY &&
    IGNORED_MODELS.some(name => item.name.toLowerCase() === name.toLowerCase())
  );
}

export default function Katalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'category'>('date');

  // Fetch items from blob storage
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items');
        const data = await response.json();
        
        if (data.items) {
          setItems(data.items);
          setFilteredItems(data.items);
        }
      } catch (err) {
        console.error('Failed to fetch items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Filter and sort items
  useEffect(() => {
    let result = [...items];

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category.startsWith(selectedCategory));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    setFilteredItems(result);
  }, [items, selectedCategory, searchQuery, sortBy]);

  const gridClass = {
    small: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    medium: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5',
    large: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }[gridSize];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f5f5f5] border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="font-mono text-sm tracking-[0.4em] font-bold text-black">
              K A T A L O G
            </h1>
            
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:border-gray-400"
              />

              {/* Category filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              >
                <option value="date">Newest</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
              </select>

              {/* Grid size */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                {(['small', 'medium', 'large'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setGridSize(size)}
                    className={`px-3 py-2 text-xs ${gridSize === size ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    {size === 'small' ? '▪▪▪' : size === 'medium' ? '▪▪' : '▪'}
                  </button>
                ))}
              </div>

              {/* Upload link */}
              <a
                href="https://katalog-upload.iverfinne.no"
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-mono hover:bg-gray-800 transition-colors"
              >
                + Upload
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="max-w-[1800px] mx-auto px-6 py-3 text-xs text-gray-500 font-mono">
        {filteredItems.length} items
        {selectedCategory !== 'all' && ` in ${selectedCategory}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Main content */}
      <main className="max-w-[1800px] mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-gray-400 font-mono text-sm">Loading catalog...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-gray-400 font-mono text-sm mb-4">No items found</div>
            <a
              href="https://katalog-upload.iverfinne.no"
              className="px-6 py-3 bg-black text-white rounded-lg text-sm font-mono"
            >
              Upload your first item
            </a>
          </div>
        ) : (
          <div className={`grid ${gridClass} gap-4`}>
            {filteredItems.map((item, index) => (
              <CatalogCard
                key={item.url}
                item={item}
                size={gridSize}
                onClick={shouldIgnoreItem(item) ? undefined : () => setSelectedItem(item)}
                index={index}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// Catalog Card Component
function CatalogCard({ 
  item, 
  size, 
  onClick,
  index 
}: { 
  item: CatalogItem; 
  size: 'small' | 'medium' | 'large';
  onClick?: () => void;
  index: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !item.url.match(/\.glb$/i)) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e8e8);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    camera.position.set(2, 1.5, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(
      item.url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const boxSize = box.getSize(new THREE.Vector3());

        model.position.sub(center);
        const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
        model.scale.setScalar(1.5 / maxDim);

        scene.add(model);
        setLoaded(true);

        // Auto-rotate
        let animationId: number;
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          model.rotation.y += 0.005;
          renderer.render(scene, camera);
        };
        animate();

        return () => {
          cancelAnimationFrame(animationId);
        };
      },
      undefined,
      () => {
        setError(true);
      }
    );

    return () => {
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [item.url]);

  const aspectClass = size === 'small' ? 'aspect-square' : 'aspect-[4/3]';
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`group ${isClickable ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className={`${aspectClass} bg-[#e8e8e8] rounded-lg overflow-hidden relative`}>
        <div ref={containerRef} className="absolute inset-0" />
        
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <span className="text-2xl">📦</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      {size !== 'small' && (
        <div className="mt-2 px-1">
          <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
          <p className="text-xs text-gray-500 font-mono">{item.category}</p>
        </div>
      )}
    </div>
  );
}

// Modal Component
function ItemModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 1000);
    camera.position.set(3, 2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Disable pan and zoom - only allow orbit
    controls.enablePan = false;
    controls.enableZoom = false;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    // Grid removed as per requirements

    const loader = new GLTFLoader();
    loader.load(item.url, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      // Scale to fit the frame better
      model.scale.setScalar(MODEL_SCALE_FACTOR / maxDim);

      // Position camera to fit model in frame
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * CAMERA_DISTANCE_MULTIPLIER;
      camera.position.set(cameraDistance, cameraDistance * CAMERA_HEIGHT_MULTIPLIER, cameraDistance);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      scene.add(model);
      setLoading(false);
    });

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      renderer.dispose();
      controls.dispose();
    };
  }, [item.url, onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 md:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-medium">{item.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{item.category}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-xl"
          >
            ×
          </button>
        </div>

        {/* 3D Viewer */}
        <div className="flex-1 relative min-h-[400px]">
          <div ref={containerRef} className="absolute inset-0" />
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5]">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
