'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

const CATEGORIES = [
  { value: 'furniture/chairs', label: '🪑 Chairs', group: 'Furniture' },
  { value: 'furniture/tables', label: '🪑 Tables', group: 'Furniture' },
  { value: 'furniture/lamps', label: '💡 Lamps', group: 'Furniture' },
  { value: 'furniture/storage', label: '🗄️ Storage', group: 'Furniture' },
  { value: 'electronics', label: '📱 Electronics', group: 'Items' },
  { value: 'kitchen', label: '🍳 Kitchen', group: 'Items' },
  { value: 'clothing', label: '👕 Clothing', group: 'Items' },
  { value: 'toys', label: '🧸 Toys', group: 'Items' },
  { value: 'tools', label: '🔧 Tools', group: 'Items' },
  { value: 'art', label: '🎨 Art & Decor', group: 'Items' },
  { value: 'personal', label: '👤 Personal', group: 'Items' },
  { value: 'misc', label: '📦 Miscellaneous', group: 'Items' },
];

export default function UploadPortal() {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const originalBBoxRef = useRef<THREE.Box3 | null>(null);

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

  const initPreview = useCallback((arrayBuffer: ArrayBuffer) => {
    if (!containerRef.current) return;

    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 1000);
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    const loader = new GLTFLoader();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);

    loader.load(url, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;

      const box = new THREE.Box3().setFromObject(model);
      originalBBoxRef.current = box.clone();
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      model.scale.setScalar(scale);

      scene.add(model);
      extractMaterials(model);

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
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }, [extractMaterials]);

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
      const screenshot = rendererRef.current.domElement.toDataURL('image/png').split(',')[1];

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
      let uploadBlob: Blob;

      if (scaleFactor && originalBBoxRef.current) {
        setUploadProgress(20);

        const exportScene = modelRef.current.clone();
        exportScene.scale.setScalar(scaleFactor);

        const exporter = new GLTFExporter();
        const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
          exporter.parse(
            exportScene,
            (result) => resolve(result as ArrayBuffer),
            (error) => reject(error),
            { binary: true }
          );
        });

        uploadBlob = new Blob([glb], { type: 'model/gltf-binary' });
      } else {
        uploadBlob = file;
      }

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

      const catalogItem = {
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

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
        <div className="font-mono text-xs tracking-widest">
          KATALOG <span className="text-neutral-500 ml-2">Upload</span>
        </div>
        <a href="https://katalog.iverfinne.no" className="text-xs text-neutral-500 hover:text-white transition">
          ← Back
        </a>
      </header>

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
            <div className="text-3xl mb-3 opacity-30">{file ? '✓' : '↑'}</div>
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
            <div
              ref={containerRef}
              className="bg-neutral-900 rounded-lg aspect-video overflow-hidden border border-neutral-800"
            />
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
              <div className="mt-2 text-xs text-amber-400 font-mono">{scaleFactor.toFixed(4)}×</div>
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
                    <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={analyzeWithAI}
            disabled={!file || isAnalyzing}
            className="w-full py-2.5 bg-neutral-900 border border-neutral-800 text-sm rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition"
          >
            {isAnalyzing ? 'Analyzing...' : '✨ AI Analyze'}
          </button>

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
            {isUploading ? 'Uploading...' : uploadResult ? '✓ Done' : 'Upload'}
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
    </div>
  );
}
