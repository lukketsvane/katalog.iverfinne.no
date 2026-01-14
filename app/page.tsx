'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Html, Center } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Search, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  X, 
  Box, 
  FileText, 
  Calendar 
} from 'lucide-react';

// --- TYPES ---
export interface MaterialInfo {
  name: string;
  type: string;
  color: string;
  metalness: number;
  roughness: number;
}

export interface CatalogMetadata {
  materials?: MaterialInfo[];
  colors?: string[];
  targetHeight?: number | null;
  scaleFactor?: number | null;
  description?: string;
  uploadedAt?: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  url: string; // GLB URL
  type: string;
  category: string;
  tags: string[];
  thumbnail?: string; // Base64 data URL
  size?: number; // Size in bytes
  metadata: CatalogMetadata;
}

export type GridSize = 'xs' | 'sm' | 'medium' | 'large';

// --- CONSTANTS ---
export const BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_YswMt0em8HYvljdK_0MOyT2ajRHDzmmTNZyphw5AD66MsSh";

// --- COMPONENTS ---

// 1. Viewer3D
interface Viewer3DProps {
  url: string;
  color?: string;
  metadata?: CatalogMetadata;
  showInfo?: boolean;
  className?: string;
  onCapture?: (url: string) => void;
}

function Model({ url, metadata }: { url: string; metadata?: CatalogMetadata }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(), [scene]);
  const ref = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scale.set(1, 1, 1);
      ref.current.rotation.set(0, 0, 0);

      const box = new THREE.Box3().setFromObject(ref.current);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      let scale = 1;
      if (metadata?.scaleFactor) {
        scale = metadata.scaleFactor;
      } else if (metadata?.targetHeight && size.y > 0) {
        scale = metadata.targetHeight / size.y;
      } else {
        if (maxDim > 0) {
           scale = 3 / maxDim;
        }
      }
      ref.current.scale.setScalar(scale);
    }
  }, [clone, metadata]);

  return <primitive object={clone} ref={ref} />;
}

function CaptureHelper({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    const timer = setTimeout(() => {
        gl.render(scene, camera);
        const data = gl.domElement.toDataURL('image/webp', 0.5);
        onCapture(data);
    }, 500);
    return () => clearTimeout(timer);
  }, [gl, scene, camera, onCapture]);
  
  return null;
}

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(_: Error) { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("ErrorBoundary caught an error:", error, errorInfo); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function ViewerLoader() {
  return <Html center><div className="text-xs font-mono text-gray-400 bg-white/80 px-2 py-1 rounded">Loading...</div></Html>;
}

function FallbackMesh({ color }: { color?: string }) {
    return (
        <mesh castShadow receiveShadow>
            <torusKnotGeometry args={[1, 0.4, 100, 16]} />
            <meshStandardMaterial color={color || "#e5e7eb"} roughness={0.2} metalness={0.5} />
        </mesh>
    );
}

const Viewer3D: React.FC<Viewer3DProps> = ({ 
    url, 
    color, 
    metadata, 
    showInfo = true, 
    className = "bg-gray-50 rounded-lg",
    onCapture
}) => {
  return (
    <div className={`w-full h-full overflow-hidden relative ${className}`}>
      <Canvas 
        shadows={showInfo} 
        dpr={[1, 2]} 
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ preserveDrawingBuffer: !!onCapture }}
      >
        <ErrorBoundary key={url} fallback={
             <Stage environment="city" intensity={0.5}>
                <Center>
                    <FallbackMesh color={color} />
                </Center>
             </Stage>
        }>
            <Suspense fallback={<ViewerLoader />}>
                <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
                    <Center>
                        <Model url={url} metadata={metadata} />
                    </Center>
                </Stage>
                {onCapture && <CaptureHelper onCapture={onCapture} />}
            </Suspense>
        </ErrorBoundary>
        <OrbitControls autoRotate={true} autoRotateSpeed={showInfo ? 2 : 4} enableZoom={showInfo} makeDefault />
      </Canvas>
      
      {showInfo && (
        <div className="absolute bottom-4 right-4 pointer-events-none">
             <span className="text-[10px] text-gray-400 font-mono uppercase bg-white/80 px-2 py-1 rounded backdrop-blur-sm border border-gray-100">Interactive 3D</span>
        </div>
      )}
    </div>
  );
};

// 2. DetailModal
interface DetailModalProps {
  item: CatalogItem;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full h-full md:max-w-5xl md:h-[90vh] bg-white md:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="md:hidden absolute top-0 left-0 right-0 z-20 p-4 flex justify-end bg-gradient-to-b from-black/20 to-transparent pointer-events-none">
             <button onClick={onClose} className="pointer-events-auto w-8 h-8 flex items-center justify-center bg-white/90 rounded-full shadow-sm">
              <X className="w-4 h-4 text-black" />
            </button>
        </div>
        <button onClick={onClose} className="hidden md:flex absolute top-4 right-4 z-20 w-8 h-8 items-center justify-center bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            <div className="w-full md:w-3/4 h-[60vh] md:h-full bg-[#f0f0f0] relative">
                <Viewer3D url={item.url} color={item.metadata.colors?.[0]} metadata={item.metadata} />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none border border-white/50">
                    Drag to rotate • Pinch to zoom
                </div>
            </div>
            <div className="w-full md:w-1/4 h-auto md:h-full bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
                <div className="p-6">
                    <div className="mb-4">
                        <span className="inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-100 rounded mb-2">
                            {item.category.split('/').pop()}
                        </span>
                        <h2 className="text-xl font-medium text-gray-900 leading-tight">{item.name}</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 py-2 border-b border-gray-50">
                            <div className="flex items-center gap-2"><FileText size={12}/> <span>File Size</span></div>
                            <span className="font-mono text-gray-900">{item.size ? (item.size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 py-2 border-b border-gray-50">
                            <div className="flex items-center gap-2"><Calendar size={12}/> <span>Added</span></div>
                            <span className="text-gray-900">{item.metadata.uploadedAt ? new Date(item.metadata.uploadedAt).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                        {item.tags.length > 0 && (
                            <div className="py-2">
                                <span className="text-[10px] uppercase text-gray-400 font-semibold mb-2 block">Tags</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {item.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] rounded border border-gray-100">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// 3. GridItem
const generationQueue: (() => void)[] = [];
let activeGenerators = 0;
const MAX_CONCURRENT_GENERATORS = 2;

const processQueue = () => {
  if (activeGenerators >= MAX_CONCURRENT_GENERATORS) return;
  const task = generationQueue.shift();
  if (task) {
    activeGenerators++;
    task();
  }
};

interface GridItemProps {
  item: CatalogItem;
  onClick: (item: CatalogItem) => void;
  onThumbnailGenerated?: (id: number, url: string) => void;
}

const GridItem: React.FC<GridItemProps> = ({ item, onClick, onThumbnailGenerated }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isHovered && !item.thumbnail && !isGenerating) {
        timeout = setTimeout(() => setShowPreview(true), 600);
    } else {
        setShowPreview(false);
    }
    return () => clearTimeout(timeout);
  }, [isHovered, item.thumbnail, isGenerating]);

  useEffect(() => {
    if (!item.thumbnail && !isGenerating && onThumbnailGenerated) {
        const task = () => setIsGenerating(true);
        generationQueue.push(task);
        processQueue();
        return () => {
             const idx = generationQueue.indexOf(task);
             if (idx > -1) generationQueue.splice(idx, 1);
        };
    }
  }, [item.thumbnail, onThumbnailGenerated]);

  const handleCapture = (url: string) => {
      activeGenerators--;
      processQueue();
      setIsGenerating(false);
      if (onThumbnailGenerated) onThumbnailGenerated(item.id, url);
  };

  return (
    <button 
      onClick={() => onClick(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative w-full aspect-square bg-white rounded-md overflow-hidden border border-transparent hover:border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-black/5"
    >
      <div className="w-full h-full bg-[#efefef] flex items-center justify-center overflow-hidden relative">
          {item.thumbnail ? (
            <img 
              src={item.thumbnail} 
              alt={item.name} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <>
                {isGenerating && (
                    <div className="absolute inset-0 z-0 opacity-0 pointer-events-none">
                        <Viewer3D url={item.url} metadata={item.metadata} showInfo={false} onCapture={handleCapture} />
                    </div>
                )}
                {showPreview && !isGenerating ? (
                    <div className="absolute inset-0 z-10 animate-in fade-in duration-500 bg-[#efefef]">
                        <Viewer3D url={item.url} metadata={item.metadata} showInfo={false} className="bg-[#efefef]" />
                    </div>
                ) : (
                    <div className="text-gray-300 flex flex-col items-center justify-center p-2 transition-opacity duration-200 group-hover:opacity-50">
                       {isGenerating ? (
                           <>
                             <Loader2 className="w-5 h-5 mb-1 opacity-50 animate-spin text-gray-400" />
                             <span className="text-[9px] font-mono opacity-50 uppercase text-gray-400">Generating...</span>
                           </>
                       ) : (
                           <>
                             <Box className="w-1/3 h-1/3 mb-1 opacity-50" strokeWidth={1.5} />
                             <span className="text-[9px] font-mono opacity-50 uppercase">3D Asset</span>
                           </>
                       )}
                    </div>
                )}
            </>
          )}
      </div>
      {!showPreview && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 pointer-events-none" />
      )}
      <div className={`absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-20`}>
        <p className="text-white text-[10px] font-medium truncate leading-tight">{item.name}</p>
        <p className="text-white/80 text-[8px] truncate">{item.size ? (item.size / (1024 * 1024)).toFixed(1) + ' MB' : 'GLB'}</p>
      </div>
    </button>
  );
};

// 4. Main App Component
interface BlobObject {
    url: string;
    pathname: string;
    size: number;
    uploadedAt: string;
}

const DEMO_ITEMS: CatalogItem[] = [
  {
    id: 1,
    name: 'Mechanical Keyboard',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/electronics/mechanical-keyboard-1768366050152-uB9sdebxEqtXAE5ySxGPopefn7HLBN.glb',
    type: '3d',
    category: 'electronics',
    tags: ['keyboard', 'mechanical', 'tech'],
    size: 31562137,
    metadata: { uploadedAt: '2026-01-14T12:00:00Z', colors: ['#333333'] }
  },
  {
    id: 2,
    name: 'Battery Energy Drink',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/kitchen/battery-energy-drink-1768364798401-5JqO78AiCwAQm7Y1W9VT1RkcKmpzYe.glb',
    type: '3d',
    category: 'kitchen',
    tags: ['drink', 'can', 'energy'],
    size: 4089446,
    metadata: { uploadedAt: '2026-01-14T12:05:00Z', colors: ['#000000'] }
  },
  {
    id: 3,
    name: 'Camel Cigarette Pack',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/personal/camel-cigarette-pack-1768363441889-J5EEUIgRekBSD0oIuJEfMrKkQjw90u.glb',
    type: '3d',
    category: 'personal',
    tags: ['cigarettes', 'camel', 'pack'],
    size: 4823449,
    metadata: { uploadedAt: '2026-01-14T12:10:00Z', colors: ['#C4A484'] }
  },
  {
    id: 6,
    name: 'Bobblehead Figurine',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/toys/man-bobblehead-figurine-1768365190007-S7dL4VU4sbK0jul3l6ZEhSZwjTaOyu.glb',
    type: '3d',
    category: 'toys',
    tags: ['figurine', 'bobblehead', 'toy'],
    size: 2516582,
    metadata: { uploadedAt: '2026-01-14T12:20:00Z', colors: ['#FFD700'] }
  }
];

export default function App() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getNameFromPath = (path: string) => {
      const parts = path.split('/');
      const file = parts[parts.length - 1];
      return file.replace('.glb', '').replace('.png', '').replace('.jpg', '').replace(/-[\d]+$/, '').replace(/-/g, ' ');
  };

  const getCategoryFromPath = (path: string) => {
      const parts = path.split('/');
      if (parts.length > 2) return parts.slice(1, parts.length - 1).join('/'); 
      return 'uncategorized';
  };

  const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('https://blob.vercel-storage.com?mode=expanded', {
                method: 'GET',
                headers: { 'authorization': `Bearer ${BLOB_READ_WRITE_TOKEN}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                const blobs: BlobObject[] = data.blobs || [];
                const glbFiles = blobs.filter(b => b.pathname.endsWith('.glb'));
                const imageFiles = blobs.filter(b => b.pathname.match(/\.(jpg|jpeg|png|webp)$/i));

                if (glbFiles.length > 0) {
                    const catalogItems: CatalogItem[] = glbFiles.map((file, index) => {
                        const name = getNameFromPath(file.pathname);
                        const category = getCategoryFromPath(file.pathname);
                        const id = new Date(file.uploadedAt).getTime() + index;
                        const baseName = file.pathname.substring(0, file.pathname.lastIndexOf('.'));
                        const thumbnailBlob = imageFiles.find(img => img.pathname.startsWith(baseName));

                        return {
                            id,
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            url: file.url,
                            type: '3d',
                            category,
                            tags: category.split('/'),
                            thumbnail: thumbnailBlob ? thumbnailBlob.url : undefined,
                            size: file.size,
                            metadata: {
                                uploadedAt: file.uploadedAt,
                                description: `Imported from ${file.pathname}`,
                                colors: [],
                                materials: []
                            }
                        };
                    });
                    setItems(catalogItems);
                } else {
                    if (DEMO_ITEMS.length > 0) setItems(DEMO_ITEMS);
                    else setItems([]);
                }
            } else {
                throw new Error(`API returned ${response.status}`);
            }
        } catch (e: any) {
            console.warn("Failed to load catalog, using demo data.", e);
            setItems(DEMO_ITEMS);
        } finally {
            setLoading(false);
        }
    };

  useEffect(() => { fetchData(); }, []);

  const handleThumbnailGenerated = (id: number, url: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, thumbnail: url } : item));
  };

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    if (selectedCategory !== 'all') filtered = filtered.filter(item => item.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q) || item.tags.some(t => t.toLowerCase().includes(q)));
    }
    return filtered;
  }, [items, selectedCategory, searchQuery]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      items.forEach(item => item.tags.forEach(t => tags.add(t)));
      return ['all', ...Array.from(tags)];
  }, [items]);

  const sizes: GridSize[] = ['xs', 'sm', 'medium', 'large'];
  const cycleGridSize = () => {
      const currentIndex = sizes.indexOf(gridSize);
      setGridSize(sizes[(currentIndex + 1) % sizes.length]);
  };

  const gridStyles = {
    xs: { gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '4px' },
    sm: { gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' },
    medium: { gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' },
    large: { gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#1a1a1a] font-sans">
      <header className="sticky top-0 z-30 bg-[#f8f8f8] border-b border-[#e5e5e5]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium tracking-tight flex items-center gap-2">katalog</span>
            <span className="text-[11px] text-gray-400 font-mono">{filteredItems.length} / {items.length} items</span>
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap mb-2">
            <span className="text-gray-400">Filter:</span>
            {categories.map((cat, i) => (
              <React.Fragment key={cat}>
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className={`hover:text-black transition-colors ${selectedCategory === cat ? 'font-medium text-black underline underline-offset-2' : 'text-gray-500'}`}
                >
                  {cat === 'all' ? 'All' : cat.split('/').pop()}
                </button>
                {i < categories.length - 1 && <span className="text-gray-300">|</span>}
              </React.Fragment>
            ))}
            <button onClick={cycleGridSize} className="ml-auto hover:text-black text-gray-500 underline underline-offset-2">Size: {gridSize}</button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
             <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search objects..."
                className="w-full px-3 py-2 text-xs bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-black transition-colors"
             />
             {searchQuery && (
                 <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"><X size={12}/></button>
             )}
          </div>
        </div>
      </header>

      <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-b border-transparent">
        {allTags.slice(0, 10).map(tag => (
          <button
            key={tag}
            onClick={() => setSearchQuery(tag === 'all' ? '' : tag)}
            className={`
                flex-shrink-0 px-3 py-1 text-[10px] rounded-full border transition-colors
                ${(tag === 'all' && !searchQuery) || searchQuery === tag ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#1a1a1a] border-[#e5e5e5] hover:border-gray-400'}
            `}
          >
            {tag === 'all' ? 'Show All' : `#${tag}`}
          </button>
        ))}
      </div>

      <main className="p-3 md:p-4 pb-20">
        {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mb-3 opacity-50"/>
                <p className="text-xs">Loading items...</p>
             </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 max-w-sm mx-auto text-center">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-3 opacity-80"/>
                <p className="text-sm font-medium mb-1">Connection Issue</p>
                <p className="text-xs text-gray-500 mb-4">{error}</p>
                <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-xs"><RefreshCw size={12}/> Retry</button>
            </div>
        ) : filteredItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search className="w-6 h-6 mb-2 opacity-50"/>
              <p className="text-xs">No objects found</p>
              <button onClick={() => {setSearchQuery(''); setSelectedCategory('all');}} className="mt-2 text-xs text-black underline">Clear filters</button>
           </div>
        ) : (
          <div style={{ display: 'grid', ...gridStyles[gridSize] }} className="w-full">
            {filteredItems.map((item) => (
              <GridItem key={item.id} item={item} onClick={setSelectedItem} onThumbnailGenerated={handleThumbnailGenerated} />
            ))}
          </div>
        )}
      </main>
      
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}
