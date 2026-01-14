'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface MaterialInfo {
  name: string;      // Material name
  type: string;      // Material type (e.g., "MeshStandard")
  color: string;     // Hex color (e.g., "#ff0000")
  metalness: number; // 0-1
  roughness: number; // 0-1
}

interface CatalogItem {
  id?: number;                    // Unique timestamp-based ID
  url: string;                   // Vercel Blob URL to GLB file
  pathname?: string;
  name: string;                  // Display name
  type?: string;                  // Always "3d"
  category: string;              // Category path (e.g., "furniture/chairs")
  tags?: string[];                // Array of lowercase tags
  thumbnail?: string;            // Base64 data URL (PNG with transparency)
  size?: number;
  uploadedAt?: string;
  metadata?: {
    materials?: MaterialInfo[];  // Extracted material data
    colors?: string[];           // Hex color codes from model
    targetHeight?: number | null; // Target height in mm
    scaleFactor?: number | null;  // Scale multiplier for real-world size
    description?: string;         // AI-generated description
    uploadedAt?: string;          // ISO 8601 timestamp
  };
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
const ZOOM_MIN_DISTANCE = 1;
const ZOOM_MAX_DISTANCE = 10;

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

  // Fetch items from localStorage and blob storage
  useEffect(() => {
    const fetchItems = async () => {
      try {
        // Read from localStorage first
        const localCatalog = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
        const localItems: CatalogItem[] = localCatalog.items || [];

        // Fetch from API
        const response = await fetch('/api/items');
        const data = await response.json();
        const apiItems: CatalogItem[] = data.items || [];

        // Merge: localStorage items take priority by URL
        const localItemUrls = new Set(localItems.map(item => item.url));
        const mergedItems = [
          ...localItems,
          ...apiItems.filter(item => !localItemUrls.has(item.url))
        ];
        
        setItems(mergedItems);
        setFilteredItems(mergedItems);
      } catch (err) {
        console.error('Failed to fetch items:', err);
        // Fallback to localStorage only if API fails
        try {
          const localCatalog = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
          setItems(localCatalog.items || []);
          setFilteredItems(localCatalog.items || []);
        } catch {
          setItems([]);
          setFilteredItems([]);
        }
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

    // Filter by search (includes tags)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query))) ||
        (item.metadata?.description && item.metadata.description.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          // Use metadata.uploadedAt if available, fallback to uploadedAt
          const aDate = a.metadata?.uploadedAt || a.uploadedAt || '0';
          const bDate = b.metadata?.uploadedAt || b.uploadedAt || '0';
          return new Date(bDate).getTime() - new Date(aDate).getTime();
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
            <div className="text-gray-400 font-mono text-sm">No items found</div>
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
    // Enable realistic/PBR rendering for thumbnails
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 5, 5);
    scene.add(light);
    // Add hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemiLight);

    const loader = new GLTFLoader();
    loader.load(
      item.url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const boxSize = box.getSize(new THREE.Vector3());

        // Center the model at origin
        model.position.sub(center);
        
        // Calculate optimal scale to fill frame
        const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
        const targetSize = 1.8; // Slightly larger to fill frame better
        model.scale.setScalar(targetSize / maxDim);

        // Calculate optimal camera distance after scaling
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        const scaledMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
        
        const fov = camera.fov * (Math.PI / 180);
        const aspectRatio = width / height;
        const fitHeightDistance = (scaledMaxDim / 2) / Math.tan(fov / 2);
        const fitWidthDistance = (scaledMaxDim / 2) / Math.tan(fov / 2) / aspectRatio;
        const cameraDistance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3;

        // Position camera at a nice angle
        const cameraAngle = Math.PI / 7; // ~25 degrees elevation
        camera.position.set(
          cameraDistance * Math.cos(cameraAngle) * Math.cos(Math.PI / 4),
          cameraDistance * Math.sin(cameraAngle),
          cameraDistance * Math.cos(cameraAngle) * Math.sin(Math.PI / 4)
        );
        camera.lookAt(0, 0, 0);

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
    // Enable realistic/PBR rendering
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Disable pan, allow limited zoom
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = ZOOM_MIN_DISTANCE;
    controls.maxDistance = ZOOM_MAX_DISTANCE;

    // Lighting setup for realistic rendering
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);
    // Add hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(hemiLight);

    // Track state for light control
    let isDraggingLight = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleKeyDownLocal = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.shiftKey) {
        isDraggingLight = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        controls.enabled = false; // Disable camera controls while adjusting light
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLight && e.shiftKey) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Rotate light position based on mouse movement
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(keyLight.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi -= deltaY * 0.01;
        // Clamp phi to prevent flipping
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        keyLight.position.setFromSpherical(spherical);
      } else if (isDraggingLight && !e.shiftKey) {
        // User released shift while dragging, stop light adjustment
        isDraggingLight = false;
        controls.enabled = true;
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLight) {
        isDraggingLight = false;
        controls.enabled = true; // Re-enable camera controls
      }
    };

    window.addEventListener('keydown', handleKeyDownLocal);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const loader = new GLTFLoader();
    loader.load(item.url, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center the model at origin
      model.position.sub(center);
      
      // Calculate the bounding sphere for better framing
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Scale the model to a normalized size
      const targetSize = 2.0;
      const scale = targetSize / maxDim;
      model.scale.setScalar(scale);

      // Recalculate bounding box after scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      const scaledMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);

      // Calculate optimal camera distance to frame the model
      const fov = camera.fov * (Math.PI / 180);
      const aspectRatio = width / height;
      // Use the larger dimension relative to FOV for proper framing
      const fitHeightDistance = (scaledMaxDim / 2) / Math.tan(fov / 2);
      const fitWidthDistance = (scaledMaxDim / 2) / Math.tan(fov / 2) / aspectRatio;
      const cameraDistance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2; // 1.2 for some padding

      // Position camera at a nice angle
      const cameraAngle = Math.PI / 6; // 30 degrees elevation
      camera.position.set(
        cameraDistance * Math.cos(cameraAngle) * Math.cos(Math.PI / 4),
        cameraDistance * Math.sin(cameraAngle),
        cameraDistance * Math.cos(cameraAngle) * Math.sin(Math.PI / 4)
      );
      
      // Set controls target to center of geometry (origin after centering)
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      
      // Update zoom limits based on model size
      controls.minDistance = cameraDistance * 0.3;
      controls.maxDistance = cameraDistance * 3;
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

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDownLocal);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.map((tag, index) => (
                  <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {item.metadata?.description && (
              <p className="text-xs text-gray-400 mt-1 max-w-md">{item.metadata.description}</p>
            )}
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
          
          {/* Light control hint */}
          {!loading && (
            <div className="absolute bottom-4 left-4 text-xs text-gray-400 font-mono pointer-events-none">
              Shift + drag to adjust lighting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
