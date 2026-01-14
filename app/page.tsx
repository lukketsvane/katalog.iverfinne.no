'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense, useLayoutEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Html, Center } from '@react-three/drei';
import * as THREE from 'three';
import {
  Loader2,
  X,
  Box,
  Maximize2,
} from 'lucide-react';

// --- LANGUAGE & TRANSLATIONS ---
type Language = 'NO' | 'EN';

interface Translations {
  about: string;
  loadingAssets: string;
  noObjectsFound: string;
  resetFilters: string;
  all: string;
  added: string;
  type: string;
  glbAsset: string;
  hostedAt: string;
  loading: string;
  aboutTitle: string;
  aboutP1: string;
  aboutP2: string;
  aboutP3: string;
  curatedDescription: string;
  categories: Record<string, string>;
  items: Record<string, string>;
}

const translations: Record<Language, Translations> = {
  EN: {
    about: 'About',
    loadingAssets: 'Loading Assets',
    noObjectsFound: 'No objects found',
    resetFilters: 'Reset Filters',
    all: 'All',
    added: 'Added',
    type: 'Type',
    glbAsset: 'GLB Asset',
    hostedAt: 'Hosted At',
    loading: 'Loading...',
    aboutTitle: 'Katalog',
    aboutP1: ' is a digital collector, ordering, categorizing, and exhibiting things. This collection represents a search for aesthetic emotion in the assemblage of everyday objects.',
    aboutP2: 'I would like to keep things as they are, but the digital landscape is ever-changing. By scanning and archiving these items, we push the limits of inertia.',
    aboutP3: 'Longing for stability in my life, I felt the urge to really lock myself into my new place. I decided then and there to digitize everything, getting up close and personal with my belongings and analyzing all of them in detail.',
    curatedDescription: 'A curated 3D object from the collection.',
    categories: {
      'all': 'All',
      'electronics': 'Electronics',
      'kitchen': 'Kitchen',
      'personal': 'Personal',
      'toys': 'Toys',
    },
    items: {
      'mechanical keyboard': 'Mechanical Keyboard',
      'battery energy drink': 'Battery Energy Drink',
      'camel cigarette pack': 'Camel Cigarette Pack',
      'bobblehead figurine': 'Bobblehead Figurine',
    },
  },
  NO: {
    about: 'Om',
    loadingAssets: 'Lastar',
    noObjectsFound: 'Fann ingen objekt',
    resetFilters: 'Nullstill',
    all: 'Alle',
    added: 'Lagt til',
    type: 'Type',
    glbAsset: 'GLB-fil',
    hostedAt: 'Ligg på',
    loading: 'Lastar...',
    aboutTitle: 'Katalog',
    aboutP1: ' er ein digital samlar som ordnar, kategoriserar og stiller ut ting. Samlinga representerer eit søk etter estetisk kjensle i samanstillinga av kvardagslege gjenstandar.',
    aboutP2: 'Eg vil gjerne halda tinga slik dei er, men det digitale landskapet er i stadig endring. Ved å skanna og arkivera desse gjenstandane utfordrar me grensene for tregleik.',
    aboutP3: 'Med eit ynskje om stabilitet i livet mitt, kjende eg trong til å verkeleg forankra meg i den nye heimen min. Eg bestemte meg der og då for å digitalisera alt, verta godt kjend med eigedelane mine og analysera dei i detalj.',
    curatedDescription: 'Eit kuratert 3D-objekt frå samlinga.',
    categories: {
      'all': 'Alle',
      'electronics': 'Elektronikk',
      'kitchen': 'Kjøken',
      'personal': 'Personleg',
      'toys': 'Leiketøy',
    },
    items: {
      'mechanical keyboard': 'Mekanisk tastatur',
      'battery energy drink': 'Battery energidrikk',
      'camel cigarette pack': 'Camel sigaretteske',
      'bobblehead figurine': 'Vippefigur',
    },
  },
};

// --- THUMBNAIL CACHE ---
const THUMBNAIL_CACHE_KEY = 'katalog_thumbnails_v2';
const THUMBNAIL_CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ThumbnailCacheEntry {
  low: string;    // ~10% quality, very small
  medium: string; // ~30% quality
  high: string;   // ~70% quality
  timestamp: number;
}

interface ThumbnailCache {
  [itemId: string]: ThumbnailCacheEntry;
}

const getThumbnailCache = (): ThumbnailCache => {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(THUMBNAIL_CACHE_KEY);
    if (!cached) return {};
    const parsed = JSON.parse(cached) as ThumbnailCache;
    const now = Date.now();
    const valid: ThumbnailCache = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (now - entry.timestamp < THUMBNAIL_CACHE_EXPIRY) {
        valid[key] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
};

const setThumbnailCache = (cache: ThumbnailCache) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage quota exceeded, clear old entries
    try {
      localStorage.removeItem(THUMBNAIL_CACHE_KEY);
    } catch { /* ignore */ }
  }
};

const resizeImage = (dataUrl: string, quality: number, maxSize: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

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

export interface ThumbnailSet {
  low: string;    // Blur placeholder
  medium: string; // Medium quality
  high: string;   // Full quality
}

export interface CatalogItem {
  id: number;
  name: string;
  url: string; // GLB URL
  type: string;
  category: string;
  tags: string[];
  thumbnail?: string; // Legacy single thumbnail or external URL
  thumbnails?: ThumbnailSet; // Multi-resolution cached thumbnails
  size?: number; // Size in bytes
  metadata: CatalogMetadata;
}

export type GridSize = 'xs' | 'sm' | 'medium' | 'large';

// --- CONSTANTS ---
const BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_YswMt0em8HYvljdK_0MOyT2ajRHDzmmTNZyphw5AD66MsSh";

// --- COMPONENTS ---

// 1. Viewer3D
interface Viewer3DProps {
  url: string;
  color?: string;
  metadata?: CatalogMetadata;
  showInfo?: boolean;
  className?: string;
  onCapture?: (thumbnails: MultiResThumbnails) => void;
  autoRotate?: boolean;
  loadingText?: string;
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

interface MultiResThumbnails {
  low: string;
  medium: string;
  high: string;
}

function CaptureHelper({ onCapture }: { onCapture: (thumbnails: MultiResThumbnails) => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const timer = setTimeout(async () => {
      gl.render(scene, camera);
      const fullRes = gl.domElement.toDataURL('image/webp', 0.9);

      // Generate 3 resolutions
      const [low, medium, high] = await Promise.all([
        resizeImage(fullRes, 0.1, 32),   // Tiny blur placeholder
        resizeImage(fullRes, 0.4, 128),  // Medium quality
        resizeImage(fullRes, 0.8, 256),  // High quality
      ]);

      onCapture({ low, medium, high });
    }, 500);
    return () => clearTimeout(timer);
  }, [gl, scene, camera, onCapture]);

  return null;
}

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(_error: Error) { return { hasError: true }; }
  componentDidCatch(error: unknown, errorInfo: unknown) { console.error("ErrorBoundary caught an error:", error, errorInfo); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function ViewerLoader({ text = 'Loading...' }: { text?: string }) {
  return <Html center><div className="text-xs font-mono text-gray-400 bg-white/80 px-2 py-1 rounded-full backdrop-blur-md border border-white/20">{text}</div></Html>;
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
    onCapture,
    autoRotate = true,
    loadingText = 'Loading...',
}) => {
  return (
    <div className={`w-full h-full overflow-hidden relative ${className}`}>
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        // FOV 12 approx 200mm lens effect for orthographic look
        camera={{ position: [0, 0, 35], fov: 12 }}
        gl={{ preserveDrawingBuffer: !!onCapture, alpha: true }}
      >
        <ErrorBoundary key={url} fallback={
             <Stage environment="city" intensity={0.5} shadows={false}>
                <Center>
                    <FallbackMesh color={color} />
                </Center>
             </Stage>
        }>
            <Suspense fallback={<ViewerLoader text={loadingText} />}>
                <Stage environment="city" intensity={0.6} adjustCamera={1.2} shadows={false}>
                    <Center>
                        <Model url={url} metadata={metadata} />
                    </Center>
                </Stage>
                {onCapture && <CaptureHelper onCapture={onCapture} />}
            </Suspense>
        </ErrorBoundary>
        <OrbitControls autoRotate={autoRotate} autoRotateSpeed={showInfo ? 0.5 : 1} enableZoom={showInfo} makeDefault />
      </Canvas>
      
      {showInfo && (
        <div className="absolute bottom-4 right-4 pointer-events-none">
             <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/50">
                <Box size={14} className="text-gray-500" />
             </div>
        </div>
      )}
    </div>
  );
};

// 2. DetailModal
interface DetailModalProps {
  item: CatalogItem;
  onClose: () => void;
  t: Translations;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, t }) => {
  const displayName = translateItemName(item.name, t);
  const displayCategory = translateCategory(item.category, t);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full h-full md:max-w-5xl md:h-[85vh] bg-white md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl shadow-black/5 animate-in slide-in-from-bottom-4 duration-500 border border-gray-100">
        
        {/* Mobile Header */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start pointer-events-none">
             <div />
             <button onClick={onClose} className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-gray-100">
              <X className="w-5 h-5 text-black" />
            </button>
        </div>

        {/* Desktop Close */}
        <button onClick={onClose} className="hidden md:flex absolute top-6 right-6 z-20 w-10 h-10 items-center justify-center bg-white/80 backdrop-blur-md rounded-full border border-gray-100 shadow-sm hover:bg-white transition-all hover:scale-105 active:scale-95">
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            {/* 3D View */}
            <div className="w-full md:w-2/3 h-[55vh] md:h-full bg-[#fcfcfc] relative">
                <Viewer3D url={item.url} color={item.metadata.colors?.[0]} metadata={item.metadata} className="bg-[#fcfcfc]" />
            </div>

            {/* Info Panel */}
            <div className="w-full md:w-1/3 h-auto md:h-full bg-white md:border-l border-gray-50 flex flex-col overflow-y-auto relative z-10 -mt-6 md:mt-0 rounded-t-[2rem] md:rounded-none">
                <div className="p-8 pt-10 md:pt-12 flex flex-col h-full">
                    <div className="flex-1">
                        <div className="mb-8">
                            <span className="inline-block text-[10px] uppercase tracking-widest font-semibold text-gray-400 mb-4">
                                {displayCategory}
                            </span>
                            <h2 className="text-3xl font-serif font-medium text-gray-900 leading-none mb-4 tracking-tight">{displayName}</h2>
                            <p className="text-sm text-gray-500 leading-relaxed font-light">
                                {item.metadata.description || t.curatedDescription}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-50">
                             <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">{t.added}</span>
                                <span className="font-mono text-xs text-gray-600">
                                    {item.metadata.uploadedAt ? new Date(item.metadata.uploadedAt).toLocaleDateString(undefined, {month: 'long', year: 'numeric'}) : 'Unknown'}
                                </span>
                             </div>
                             <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">{t.type}</span>
                                <span className="font-mono text-xs text-gray-600">{t.glbAsset}</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// 3. AboutSection (inline, replaces grid)
const AboutSection = ({ t }: { t: Translations }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-12 md:py-24">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-5xl md:text-7xl font-serif mb-12 md:mb-16 tracking-tight">{t.aboutTitle}</h1>

                <div className="grid md:grid-cols-2 gap-10 md:gap-20 text-sm md:text-base leading-relaxed text-gray-600 font-light">
                    <div className="space-y-6">
                        <p>
                            <span className="text-black font-medium">Iver Finne</span>{t.aboutP1}
                        </p>
                        <p>
                            {t.aboutP2}
                        </p>
                    </div>
                    <div className="space-y-6">
                        <p>
                            {t.aboutP3}
                        </p>
                        <div className="pt-8 border-t border-gray-200">
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t.hostedAt}</p>
                            <a href="https://katalog.iverfinne.no" className="text-black font-mono hover:underline">katalog.iverfinne.no</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. GridItem with Progressive Loading
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

// Progressive Image Component
const ProgressiveImage: React.FC<{
  thumbnails?: ThumbnailSet;
  fallbackUrl?: string;
  alt: string;
}> = ({ thumbnails, fallbackUrl, alt }) => {
  const [loadedLevel, setLoadedLevel] = useState<'none' | 'low' | 'medium' | 'high'>('none');

  useEffect(() => {
    if (!thumbnails) {
      if (fallbackUrl) setLoadedLevel('high');
      return;
    }

    // Start with low immediately
    setLoadedLevel('low');

    // Load medium
    const mediumImg = new Image();
    mediumImg.onload = () => setLoadedLevel('medium');
    mediumImg.src = thumbnails.medium;

    // Load high
    const highImg = new Image();
    highImg.onload = () => setLoadedLevel('high');
    highImg.src = thumbnails.high;
  }, [thumbnails, fallbackUrl]);

  const getCurrentSrc = () => {
    if (!thumbnails) return fallbackUrl;
    switch (loadedLevel) {
      case 'high': return thumbnails.high;
      case 'medium': return thumbnails.medium;
      case 'low': return thumbnails.low;
      default: return thumbnails.low;
    }
  };

  const src = getCurrentSrc();
  if (!src) return null;

  return (
    <div className="w-full h-full relative">
      {/* Blur placeholder layer */}
      {thumbnails && loadedLevel !== 'high' && (
        <img
          src={thumbnails.low}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          aria-hidden="true"
        />
      )}
      {/* Main image */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ease-out ${
          loadedLevel === 'low' ? 'blur-sm scale-110' : ''
        }`}
        loading="lazy"
      />
    </div>
  );
};

// Helper to translate item names
const translateItemName = (name: string, t: Translations): string => {
  const key = name.toLowerCase();
  return t.items[key] || name;
};

// Helper to translate category names
const translateCategory = (category: string, t: Translations): string => {
  const key = category.split('/').pop() || category;
  return t.categories[key] || key;
};

interface GridItemProps {
  item: CatalogItem;
  onClick: (item: CatalogItem) => void;
  onThumbnailGenerated?: (id: number, thumbnails: MultiResThumbnails) => void;
  t: Translations;
}

const GridItem: React.FC<GridItemProps> = ({ item, onClick, onThumbnailGenerated, t }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const hasThumbnail = item.thumbnails || item.thumbnail;
  const displayName = translateItemName(item.name, t);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const isTouch = 'ontouchstart' in window;

    if (isHovered && !hasThumbnail && !isGenerating && !isTouch) {
      timeout = setTimeout(() => setShowPreview(true), 600);
    } else {
      setShowPreview(false);
    }
    return () => clearTimeout(timeout);
  }, [isHovered, hasThumbnail, isGenerating]);

  useEffect(() => {
    if (!hasThumbnail && !isGenerating && onThumbnailGenerated) {
      const task = () => setIsGenerating(true);
      generationQueue.push(task);
      processQueue();
      return () => {
        const idx = generationQueue.indexOf(task);
        if (idx > -1) generationQueue.splice(idx, 1);
      };
    }
  }, [hasThumbnail, onThumbnailGenerated, isGenerating]);

  const handleCapture = useCallback((thumbnails: MultiResThumbnails) => {
    activeGenerators--;
    processQueue();
    setIsGenerating(false);
    if (onThumbnailGenerated) onThumbnailGenerated(item.id, thumbnails);
  }, [item.id, onThumbnailGenerated]);

  return (
    <div
      onClick={() => onClick(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative w-full aspect-square bg-white rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
    >
      <div className="w-full h-full bg-[#fcfcfc] flex items-center justify-center overflow-hidden relative">
        {hasThumbnail ? (
          <ProgressiveImage
            thumbnails={item.thumbnails}
            fallbackUrl={item.thumbnail}
            alt={item.name}
          />
        ) : (
          <>
            {isGenerating && (
              <div className="absolute inset-0 z-0 opacity-0 pointer-events-none">
                <Viewer3D url={item.url} metadata={item.metadata} showInfo={false} onCapture={handleCapture} autoRotate={false} />
              </div>
            )}
            {showPreview && !isGenerating ? (
              <div className="absolute inset-0 z-10 animate-in fade-in duration-500 bg-[#fcfcfc]">
                <Viewer3D url={item.url} metadata={item.metadata} showInfo={false} className="bg-[#fcfcfc]" />
              </div>
            ) : (
              <div className="text-gray-300 flex flex-col items-center justify-center p-2 transition-opacity duration-200 group-hover:opacity-50">
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 opacity-30 animate-spin text-gray-500" />
                ) : (
                  <Box className="w-8 h-8 opacity-20" strokeWidth={1.5} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-3 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="inline-block bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-black text-[10px] font-medium tracking-wide shadow-sm border border-black/5">
          {displayName}
        </span>
      </div>
    </div>
  );
};

// 5. Main App Component
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
    tags: ['keyboard', 'tech'],
    size: 31562137,
    metadata: { uploadedAt: '2026-01-14T12:00:00Z', colors: ['#333333'] }
  },
  {
    id: 2,
    name: 'Battery Energy Drink',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/kitchen/battery-energy-drink-1768364798401-5JqO78AiCwAQm7Y1W9VT1RkcKmpzYe.glb',
    type: '3d',
    category: 'kitchen',
    tags: ['drink', 'energy'],
    size: 4089446,
    metadata: { uploadedAt: '2026-01-14T12:05:00Z', colors: ['#000000'] }
  },
  {
    id: 3,
    name: 'Camel Cigarette Pack',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/personal/camel-cigarette-pack-1768363441889-J5EEUIgRekBSD0oIuJEfMrKkQjw90u.glb',
    type: '3d',
    category: 'personal',
    tags: ['cigarettes'],
    size: 4823449,
    metadata: { uploadedAt: '2026-01-14T12:10:00Z', colors: ['#C4A484'] }
  },
  {
    id: 6,
    name: 'Bobblehead Figurine',
    url: 'https://yswmt0em8hyvljdk.public.blob.vercel-storage.com/toys/man-bobblehead-figurine-1768365190007-S7dL4VU4sbK0jul3l6ZEhSZwjTaOyu.glb',
    type: '3d',
    category: 'toys',
    tags: ['figurine', 'toy'],
    size: 2516582,
    metadata: { uploadedAt: '2026-01-14T12:20:00Z', colors: ['#FFD700'] }
  }
];

export default function Page() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [language, setLanguage] = useState<Language>('EN');
  const thumbnailCacheRef = useRef<ThumbnailCache>({});

  const t = translations[language];

  // Load cached thumbnails on mount
  useEffect(() => {
    thumbnailCacheRef.current = getThumbnailCache();
  }, []);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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
            const cache = thumbnailCacheRef.current;
            const catalogItems: CatalogItem[] = glbFiles.map((file, index) => {
              const name = getNameFromPath(file.pathname);
              const category = getCategoryFromPath(file.pathname);
              const id = new Date(file.uploadedAt).getTime() + index;
              const baseName = file.pathname.substring(0, file.pathname.lastIndexOf('.'));
              const thumbnailBlob = imageFiles.find(img => img.pathname.startsWith(baseName));
              const cachedThumbnails = cache[String(id)];

              return {
                id,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                url: file.url,
                type: '3d',
                category,
                tags: category.split('/'),
                thumbnail: thumbnailBlob ? thumbnailBlob.url : undefined,
                thumbnails: cachedThumbnails ? {
                  low: cachedThumbnails.low,
                  medium: cachedThumbnails.medium,
                  high: cachedThumbnails.high,
                } : undefined,
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
            setItems(DEMO_ITEMS);
          }
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (e: unknown) {
        console.warn("Using demo data.", e);
        setItems(DEMO_ITEMS);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleThumbnailGenerated = useCallback((id: number, thumbnails: MultiResThumbnails) => {
    // Update items with new thumbnails
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, thumbnails } : item
    ));

    // Save to cache
    thumbnailCacheRef.current[String(id)] = {
      ...thumbnails,
      timestamp: Date.now(),
    };
    setThumbnailCache(thumbnailCacheRef.current);
  }, []);

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    if (selectedCategory !== 'all') filtered = filtered.filter(item => item.category === selectedCategory);
    return filtered;
  }, [items, selectedCategory]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.category)))], [items]);

  const sizes: GridSize[] = ['xs', 'sm', 'medium', 'large'];
  const cycleGridSize = () => {
      const currentIndex = sizes.indexOf(gridSize);
      setGridSize(sizes[(currentIndex + 1) % sizes.length]);
  };

  const gridStyles = {
    xs: { gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' },
    sm: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' },
    medium: { gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' },
    large: { gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#fafafa]/90 backdrop-blur-xl border-b border-gray-100/50 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                 <h1 className="font-serif text-xl font-medium tracking-tight">Katalog</h1>
             </div>

             <div className="flex items-center gap-3">
                 <button
                   onClick={() => setLanguage(l => l === 'EN' ? 'NO' : 'EN')}
                   className="text-xs font-bold text-gray-400 hover:text-black transition-colors tracking-wider"
                 >
                   {language === 'EN' ? 'NO' : 'EN'}
                 </button>
                 <button
                   onClick={() => setShowAbout(prev => !prev)}
                   className={`text-xs font-medium transition-colors ${showAbout ? 'text-black' : 'text-gray-500 hover:text-black'}`}
                 >
                   {t.about}
                 </button>
                 <div className="h-3 w-px bg-gray-200"></div>
                 <button onClick={cycleGridSize} className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors">
                   <Maximize2 size={16} className="text-gray-400 hover:text-black transition-colors"/>
                 </button>
             </div>
          </div>
          
          {!showAbout && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 -ml-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                      px-3 py-1 text-[11px] font-medium transition-all duration-300 whitespace-nowrap bg-transparent rounded-full
                      ${selectedCategory === cat
                          ? 'text-black opacity-100'
                          : 'text-gray-400 opacity-60 hover:opacity-100 hover:text-gray-800'}
                  `}
                >
                  {t.categories[cat] || cat.split('/').pop()}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12">
        {showAbout ? (
          <AboutSection t={t} />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-300">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-black/10"/>
            <p className="text-xs font-medium uppercase tracking-widest opacity-50">{t.loadingAssets}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-300">
            <Box className="w-12 h-12 mb-4 opacity-20"/>
            <p className="text-sm font-medium text-gray-400">{t.noObjectsFound}</p>
            <button onClick={() => setSelectedCategory('all')} className="mt-4 text-xs font-semibold text-black border-b border-black pb-0.5 hover:opacity-70 transition-opacity">{t.resetFilters}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', ...gridStyles[gridSize] }} className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredItems.map((item) => (
              <GridItem key={item.id} item={item} onClick={setSelectedItem} onThumbnailGenerated={handleThumbnailGenerated} t={t} />
            ))}
          </div>
        )}
      </main>

      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} t={t} />}
    </div>
  );
}