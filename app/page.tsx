'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { upload } from '@vercel/blob/client';

interface MaterialInfo {
  name: string;
  type: string;
  color: string;
  metalness: number;
  roughness: number;
}

interface UploadedBlob {
  url: string;
  pathname: string;
}

interface CatalogItem {
  id: number;
  name: string;
  url: string;
  type: string;
  category: string;
  tags: string[];
  metadata: {
    materials?: MaterialInfo[];
    colors?: string[];
    targetHeight?: number | null;
    scaleFactor?: number | null;
    description?: string;
    uploadedAt?: string;
  };
}

const CATEGORIES = [
  { value: 'furniture/chairs', label: 'Chairs', group: 'Furniture' },
  { value: 'furniture/tables', label: 'Tables', group: 'Furniture' },
  { value: 'furniture/lamps', label: 'Lamps', group: 'Furniture' },
  { value: 'furniture/storage', label: 'Storage', group: 'Furniture' },
  { value: 'electronics', label: 'Electronics', group: 'Items' },
  { value: 'kitchen', label: 'Kitchen', group: 'Items' },
  { value: 'clothing', label: 'Clothing', group: 'Items' },
  { value: 'toys', label: 'Toys', group: 'Items' },
  { value: 'tools', label: 'Tools', group: 'Items' },
  { value: 'art', label: 'Art & Decor', group: 'Items' },
  { value: 'personal', label: 'Personal', group: 'Items' },
  { value: 'misc', label: 'Miscellaneous', group: 'Items' },
];

export default function UploadPortal() {
  const [activeTab, setActiveTab] = useState<'upload' | 'browse'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [objectName, setObjectName] = useState('');
  const [targetHeight, setTargetHeight] = useState<number | ''>('');
  const [category, setCategory] = useState('misc');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [materials, setMaterials] = useState<MaterialInfo[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadedBlob | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [modelStats, setModelStats] = useState<{
    triangles: number;
    materials: number;
    width: number;
    height: number;
    depth: number;
  } | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('rotate');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  
  // Viewer controls state
  const [light1On, setLight1On] = useState(true);
  const [light2On, setLight2On] = useState(true);
  const [light3On, setLight3On] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const originalBBoxRef = useRef<THREE.Box3 | null>(null);
  
  // Light and grid refs
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const extractMaterials = useCallback((model: THREE.Group) => {
    const mats: MaterialInfo[] = [];
    const cols: string[] = [];
    const colorSet = new Set<string>();
    const matSet = new Set<string>();

    model.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        meshMats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          const key = `${m.name}-${m.color?.getHexString()}`;
          
          if (!matSet.has(key)) {
            matSet.add(key);
            mats.push({
              name: m.name || 'Unnamed',
              type: m.type.replace('Material', ''),
              color: m.color ? `#${m.color.getHexString()}` : '#cccccc',
              metalness: m.metalness ?? 0,
              roughness: m.roughness ?? 1,
            });
          }

          if (m.color) {
            const hex = `#${m.color.getHexString()}`;
            if (!colorSet.has(hex) && hex !== '#000000') {
              colorSet.add(hex);
              cols.push(hex);
            }
          }
        });
      }
    });

    setMaterials(mats);
    setColors(cols);
  }, []);

  // Load catalog items from localStorage
  useEffect(() => {
    const loadItems = () => {
      const existing = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
      setCatalogItems(existing.items || []);
    };
    loadItems();
    window.addEventListener('storage', loadItems);
    return () => window.removeEventListener('storage', loadItems);
  }, []);

  // Snap model bottom to ground
  const snapToGround = useCallback((model: THREE.Group) => {
    const box = new THREE.Box3().setFromObject(model);
    const minY = box.min.y;
    model.position.y -= minY;
  }, []);

  const initPreview = useCallback((arrayBuffer: ArrayBuffer) => {
    if (!containerRef.current) return;

    // Cleanup existing
    if (transformControlsRef.current) {
      transformControlsRef.current.dispose();
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 1000);
    camera.position.set(2, 2, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControlsRef.current = orbitControls;

    // Three physical lights for realistic shading (no env map)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // Third light - rim/back light for more realistic shading
    const rimLight = new THREE.DirectionalLight(0xe6f0ff, 1.5);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Ground plane for shadows
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(4, 20, 0x333333, 0x222222);
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    const loader = new GLTFLoader();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);

    loader.load(url, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;

      // Enable shadows on all meshes
      model.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          (node as THREE.Mesh).castShadow = true;
          (node as THREE.Mesh).receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      originalBBoxRef.current = box.clone();
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center horizontally, snap bottom to ground
      model.position.set(-center.x, -box.min.y, -center.z);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      model.scale.setScalar(scale);

      // Re-snap after scaling
      snapToGround(model);

      scene.add(model);
      extractMaterials(model);

      // Setup transform controls
      const transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.attach(model);
      transformControls.setMode('rotate');
      scene.add(transformControls);
      transformControlsRef.current = transformControls;

      // Disable orbit controls while dragging transform
      transformControls.addEventListener('dragging-changed', (event) => {
        orbitControls.enabled = !event.value;
        if (!event.value) {
          // Snap to ground after transform
          snapToGround(model);
        }
      });

      let triangles = 0;
      const matSet = new Set<string>();

      gltf.scene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const geo = mesh.geometry;
          if (geo.index) {
            triangles += geo.index.count / 3;
          } else if (geo.attributes.position) {
            triangles += geo.attributes.position.count / 3;
          }
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => matSet.add(m.uuid));
          }
        }
      });

      setModelStats({
        triangles: Math.round(triangles),
        materials: matSet.size,
        width: parseFloat(size.x.toFixed(3)),
        height: parseFloat(size.y.toFixed(3)),
        depth: parseFloat(size.z.toFixed(3)),
      });

      URL.revokeObjectURL(url);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();
  }, [extractMaterials, snapToGround]);

  // Update transform mode
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // Update light 1 (key light) visibility
  useEffect(() => {
    if (keyLightRef.current) {
      keyLightRef.current.visible = light1On;
    }
  }, [light1On]);

  // Update light 2 (fill light) visibility
  useEffect(() => {
    if (fillLightRef.current) {
      fillLightRef.current.visible = light2On;
    }
  }, [light2On]);

  // Update light 3 (rim light) visibility
  useEffect(() => {
    if (rimLightRef.current) {
      rimLightRef.current.visible = light3On;
    }
  }, [light3On]);

  // Update grid visibility
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = gridVisible;
    }
  }, [gridVisible]);

  // Update background color (dark/light mode)
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(darkMode ? 0x000000 : 0xffffff);
    }
    if (gridRef.current) {
      // Update grid colors based on mode
      gridRef.current.dispose();
      if (sceneRef.current) {
        sceneRef.current.remove(gridRef.current);
        const newGrid = new THREE.GridHelper(
          4, 
          20, 
          darkMode ? 0x333333 : 0xcccccc, 
          darkMode ? 0x222222 : 0xdddddd
        );
        newGrid.visible = gridVisible;
        sceneRef.current.add(newGrid);
        gridRef.current = newGrid;
      }
    }
  }, [darkMode, gridVisible]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setObjectName(f.name.replace(/\.(glb|gltf)$/i, ''));
    setUploadResult(null);
    setAiDescription('');

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        initPreview(e.target.result as ArrayBuffer);
      }
    };
    reader.readAsArrayBuffer(f);
  }, [initPreview]);

  useEffect(() => {
    if (targetHeight && originalBBoxRef.current) {
      const originalHeight = originalBBoxRef.current.max.y - originalBBoxRef.current.min.y;
      setScaleFactor(Number(targetHeight) / originalHeight);
    } else {
      setScaleFactor(null);
    }
  }, [targetHeight]);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const analyzeWithAI = async () => {
    if (!rendererRef.current) return;

    setIsAnalyzing(true);

    try {
      // Temporarily hide transform controls for clean screenshot
      if (transformControlsRef.current) {
        transformControlsRef.current.visible = false;
      }
      
      // Render a frame without controls
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      const screenshot = rendererRef.current.domElement.toDataURL('image/png').split(',')[1];

      // Restore transform controls
      if (transformControlsRef.current) {
        transformControlsRef.current.visible = true;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: screenshot,
          materials: materials.map((m) => ({
            name: m.name,
            type: m.type,
            color: m.color,
            metalness: m.metalness,
            roughness: m.roughness,
          })),
        }),
      });

      const data = await response.json();

      // Auto-set name if suggested
      if (data.name) {
        setObjectName(data.name);
      }
      // Auto-set height if suggested
      if (data.heightMm && typeof data.heightMm === 'number') {
        setTargetHeight(data.heightMm);
      }
      if (data.tags) {
        setTags((prev) => Array.from(new Set([...prev, ...data.tags])));
      }
      if (data.category) {
        setCategory(data.category);
      }
      if (data.description) {
        setAiDescription(data.description);
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !modelRef.current) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(20);

      // Clone and bake in transform (position as origin, rotation applied)
      const exportScene = modelRef.current.clone();
      
      // Apply current transformation to geometry
      exportScene.updateMatrixWorld(true);
      exportScene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          mesh.geometry = mesh.geometry.clone();
          mesh.geometry.applyMatrix4(mesh.matrixWorld);
          mesh.position.set(0, 0, 0);
          mesh.rotation.set(0, 0, 0);
          mesh.scale.set(1, 1, 1);
          mesh.updateMatrix();
        }
      });

      // Apply scale factor if set
      if (scaleFactor && originalBBoxRef.current) {
        exportScene.scale.setScalar(scaleFactor);
      }

      const exporter = new GLTFExporter();
      const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          exportScene,
          (result) => resolve(result as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        );
      });

      const uploadBlob = new Blob([glb], { type: 'model/gltf-binary' });

      setUploadProgress(40);

      const safeName = (objectName || 'model')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `${safeName}-${Date.now()}.glb`;
      const pathname = `${category}/${filename}`;

      // Use client-side upload to bypass Vercel's 4.5MB serverless function limit
      const result = await upload(pathname, uploadBlob, {
        access: 'public',
        handleUploadUrl: '/api/upload/token',
        onUploadProgress: (progress) => {
          setUploadProgress(40 + Math.round(progress.percentage * 0.5));
        },
      });

      setUploadProgress(100);
      setUploadResult({ url: result.url, pathname: result.pathname });

      const catalogItem: CatalogItem = {
        id: Date.now(),
        name: objectName || 'Unnamed',
        url: result.url,
        type: '3d',
        category,
        tags,
        metadata: {
          materials,
          colors,
          targetHeight: targetHeight || null,
          scaleFactor,
          description: aiDescription,
          uploadedAt: new Date().toISOString(),
        },
      };

      const existing = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
      existing.items.push(catalogItem);
      localStorage.setItem('katalog-config', JSON.stringify(existing));
      setCatalogItems(existing.items);

    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const groupedCategories = CATEGORIES.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {} as Record<string, typeof CATEGORIES>);

  // Delete item from catalog
  const deleteItem = (id: number) => {
    const existing = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
    existing.items = existing.items.filter((item: CatalogItem) => item.id !== id);
    localStorage.setItem('katalog-config', JSON.stringify(existing));
    setCatalogItems(existing.items);
    setEditingItem(null);
  };

  // Update item in catalog
  const updateItem = (updatedItem: CatalogItem) => {
    const existing = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
    existing.items = existing.items.map((item: CatalogItem) => 
      item.id === updatedItem.id ? updatedItem : item
    );
    localStorage.setItem('katalog-config', JSON.stringify(existing));
    setCatalogItems(existing.items);
    setEditingItem(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
        <div className="font-mono text-xs tracking-widest">
          KATALOG
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`text-xs transition ${activeTab === 'upload' ? 'text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`text-xs transition ${activeTab === 'browse' ? 'text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Browse
          </button>
        </div>
        <a href="https://katalog.iverfinne.no" className="text-xs text-neutral-500 hover:text-white transition">
          Back
        </a>
      </header>

      {activeTab === 'upload' ? (
        <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <div
              className={`bg-neutral-900 border rounded-lg p-8 text-center cursor-pointer transition-all
                ${dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-neutral-800'}
                ${file ? 'border-green-500/50 bg-green-500/5' : 'border-dashed'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f && (f.name.endsWith('.glb') || f.name.endsWith('.gltf'))) {
                  handleFile(f);
                }
              }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <p className="font-mono text-xs text-neutral-400">
                {file ? file.name : 'Drop GLB/GLTF'}
              </p>
              {file && <p className="text-xs text-neutral-600 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              <input
                id="fileInput"
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {file && (
              <div className="relative">
                <div
                  ref={containerRef}
                  className="bg-neutral-900 rounded-lg aspect-video overflow-hidden border border-neutral-800"
                />
                {/* Transform mode buttons */}
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <button
                    onClick={() => setTransformMode('rotate')}
                    className={`px-3 py-1.5 text-xs rounded transition ${
                      transformMode === 'rotate' 
                        ? 'bg-white text-black' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Rotate
                  </button>
                  <button
                    onClick={() => setTransformMode('translate')}
                    className={`px-3 py-1.5 text-xs rounded transition ${
                      transformMode === 'translate' 
                        ? 'bg-white text-black' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Move
                  </button>
                </div>
                {/* Viewer controls - bottom right */}
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  {/* Light 1 toggle */}
                  <button
                    onClick={() => setLight1On(!light1On)}
                    className={`p-2 rounded transition ${
                      light1On 
                        ? 'bg-yellow-500/80 text-black' 
                        : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Key Light"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
                    </svg>
                  </button>
                  {/* Light 2 toggle */}
                  <button
                    onClick={() => setLight2On(!light2On)}
                    className={`p-2 rounded transition ${
                      light2On 
                        ? 'bg-yellow-500/80 text-black' 
                        : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Fill Light"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
                    </svg>
                  </button>
                  {/* Light 3 toggle */}
                  <button
                    onClick={() => setLight3On(!light3On)}
                    className={`p-2 rounded transition ${
                      light3On 
                        ? 'bg-yellow-500/80 text-black' 
                        : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Rim Light"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
                    </svg>
                  </button>
                  {/* Divider */}
                  <div className="w-px bg-neutral-600 mx-1" />
                  {/* Grid toggle */}
                  <button
                    onClick={() => setGridVisible(!gridVisible)}
                    className={`p-2 rounded transition ${
                      gridVisible 
                        ? 'bg-blue-500/80 text-white' 
                        : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Grid"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/>
                    </svg>
                  </button>
                  {/* Dark/Light mode toggle */}
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`p-2 rounded transition ${
                      darkMode 
                        ? 'bg-neutral-800/80 text-white hover:bg-neutral-700' 
                        : 'bg-white/80 text-black hover:bg-neutral-200'
                    }`}
                    title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {darkMode ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                      </svg>
                    )}
                  </button>
                </div>
                {/* Camera capture button */}
                <button
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  className="absolute top-3 right-3 p-2 bg-neutral-800/80 hover:bg-neutral-700 rounded transition disabled:opacity-50"
                  title="Capture and analyze with AI"
                >
                  {isAnalyzing ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            {aiDescription && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300">{aiDescription}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {modelStats && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                  <div className="font-mono text-sm">{modelStats.triangles.toLocaleString()}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">tris</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                  <div className="font-mono text-sm">{modelStats.materials}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">mats</div>
                </div>
              </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
              <input
                type="text"
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
              >
                {Object.entries(groupedCategories).map(([group, cats]) => (
                  <optgroup key={group} label={group}>
                    {cats.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetHeight}
                  onChange={(e) => setTargetHeight(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Height"
                  className="flex-1 px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
                />
                <span className="px-3 py-2 bg-neutral-800 rounded text-xs text-neutral-400">mm</span>
              </div>
              {scaleFactor && (
                <div className="mt-2 text-xs text-amber-400 font-mono">{scaleFactor.toFixed(4)}x</div>
              )}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
                placeholder="Add tag..."
                className="w-full px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="bg-neutral-800 px-2 py-1 rounded text-xs flex items-center gap-1.5">
                      {tag}
                      <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-white">x</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(materials.length > 0 || colors.length > 0) && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                {colors.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {colors.slice(0, 6).map((color, i) => (
                      <div key={i} className="w-6 h-6 rounded border border-neutral-700" style={{ backgroundColor: color }} title={color} />
                    ))}
                  </div>
                )}
                {materials.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {materials.slice(0, 4).map((mat, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-black rounded">
                        <div className="w-5 h-5 rounded" style={{ backgroundColor: mat.color }} />
                        <span className="text-[10px] text-neutral-400 truncate">{mat.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`w-full py-3 rounded-lg font-medium text-sm transition-all
                ${uploadResult 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500'}`}
            >
              {isUploading ? 'Uploading...' : uploadResult ? 'Done' : 'Upload'}
            </button>

            {isUploading && (
              <div className="h-1 bg-neutral-800 rounded overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}

            {uploadResult && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="font-mono text-[10px] text-green-400 break-all">{uploadResult.url}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(uploadResult.url)}
                  className="mt-2 text-xs text-green-300 hover:text-green-200"
                >
                  Copy URL
                </button>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* Browse Tab */
        <main className="max-w-6xl mx-auto p-6">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="font-mono text-sm text-neutral-400">Library ({catalogItems.length} items)</h2>
          </div>

          {catalogItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-neutral-500 text-sm">No items in library yet</p>
              <button 
                onClick={() => setActiveTab('upload')}
                className="mt-4 px-4 py-2 bg-neutral-800 rounded text-sm hover:bg-neutral-700 transition"
              >
                Upload your first model
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {catalogItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden group"
                >
                  <div className="aspect-square bg-neutral-800 flex items-center justify-center">
                    <span className="text-neutral-600 text-xs font-mono">3D</span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{item.category}</p>
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="flex-1 py-1.5 text-xs bg-neutral-800 rounded hover:bg-neutral-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="py-1.5 px-3 text-xs bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Modal */}
          {editingItem && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-md">
                <h3 className="font-mono text-sm mb-4">Edit Item</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="Name"
                    className="w-full px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
                  />
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-neutral-800 rounded text-sm focus:outline-none focus:border-neutral-600"
                  >
                    {Object.entries(groupedCategories).map(([group, cats]) => (
                      <optgroup key={group} label={group}>
                        {cats.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1.5">
                    {editingItem.tags.map((tag, i) => (
                      <span key={i} className="bg-neutral-800 px-2 py-1 rounded text-xs flex items-center gap-1.5">
                        {tag}
                        <button 
                          onClick={() => setEditingItem({ 
                            ...editingItem, 
                            tags: editingItem.tags.filter((_, j) => j !== i) 
                          })} 
                          className="text-neutral-500 hover:text-white"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateItem(editingItem)}
                      className="flex-1 py-2 bg-white text-black rounded text-sm hover:bg-neutral-200 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingItem(null)}
                      className="px-4 py-2 bg-neutral-800 rounded text-sm hover:bg-neutral-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
