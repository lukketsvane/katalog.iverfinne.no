'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

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
        setTags((prev) => [...new Set([...prev, ...data.tags])]);
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
        setUploadProgress(30);

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

      setUploadProgress(50);

      const safeName = (objectName || 'model')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `${safeName}-${Date.now()}.glb`;
      const pathname = `${category}/${filename}`;

      const formData = new FormData();
      formData.append('file', uploadBlob, filename);
      formData.append('pathname', pathname);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadProgress(100);
      setUploadResult(result);

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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-gray-800 px-8 py-5 flex justify-between items-center">
        <div className="font-mono text-sm tracking-[0.4em] font-bold">
          K A T A L O G <span className="font-normal opacity-40 ml-4 tracking-wider text-cyan-400">Upload</span>
        </div>
        <a href="https://katalog.iverfinne.no" className="text-sm opacity-50 hover:opacity-100 transition-opacity">
          ← Back to catalog
        </a>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div>
          <div
            className={`bg-[#141414] border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all
              ${dragOver ? 'border-cyan-500 bg-cyan-500/5' : 'border-gray-700'}
              ${file ? 'border-solid border-emerald-500 bg-emerald-500/5' : ''}`}
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
            <div className="text-5xl mb-4 opacity-40">{file ? '✓' : '📦'}</div>
            <h2 className="font-mono text-sm tracking-wider mb-2">
              {file ? file.name : 'DROP GLB/GLTF FILE HERE'}
            </h2>
            <p className="text-sm opacity-50">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Click to change` : 'or click to browse'}
            </p>
            <input
              id="fileInput"
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div className="mt-6">
              <div
                ref={containerRef}
                className="bg-[#1a1a1a] rounded-xl aspect-[16/10] overflow-hidden border border-gray-800"
              />
            </div>
          )}

          {aiDescription && (
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-sm text-cyan-300">{aiDescription}</p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {modelStats && (
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
              <h3 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-4">Model Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                  <div className="font-mono text-lg font-bold text-cyan-400">{modelStats.triangles.toLocaleString()}</div>
                  <div className="text-xs opacity-50 mt-1">Triangles</div>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                  <div className="font-mono text-lg font-bold text-cyan-400">{modelStats.materials}</div>
                  <div className="text-xs opacity-50 mt-1">Materials</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
            <h3 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-4">Category</h3>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
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
            <p className="text-xs opacity-40 mt-2 font-mono">Path: /{category}/</p>
          </div>

          <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
            <h3 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-4">Target Dimensions</h3>
            <label className="block text-sm mb-2 opacity-70">Real-world Height</label>
            <div className="flex">
              <input
                type="number"
                value={targetHeight}
                onChange={(e) => setTargetHeight(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 150"
                className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-l-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="px-4 py-3 bg-gray-800 border border-l-0 border-gray-700 rounded-r-lg font-mono text-sm text-gray-400">
                mm
              </span>
            </div>
            {scaleFactor && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                <strong className="font-mono text-amber-400">Scale: {scaleFactor.toFixed(4)}×</strong>
                <br />
                <small className="opacity-60">Model will be uniformly scaled</small>
              </div>
            )}
          </div>

          <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
            <h3 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-4">Metadata</h3>
            <label className="block text-sm mb-2 opacity-70">Object Name</label>
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="e.g. Eames Lounge Chair"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-lg mb-4 text-white focus:outline-none focus:border-cyan-500"
            />

            <label className="block text-sm mb-2 opacity-70">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
              placeholder="Type and press Enter"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag, i) => (
                <span key={i} className="bg-gray-800 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                  {tag}
                  <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
            <h3 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-4">AI Analysis</h3>
            <button
              onClick={analyzeWithAI}
              disabled={!file || isAnalyzing}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-mono text-xs tracking-wider disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 transition-all hover:from-cyan-500 hover:to-blue-500"
            >
              {isAnalyzing ? '🔄 Analyzing with Gemini 3...' : '🤖 ANALYZE WITH GEMINI 3'}
            </button>

            {materials.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-800">
                <h4 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-3">Materials</h4>
                <div className="grid grid-cols-2 gap-2">
                  {materials.slice(0, 6).map((mat, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-[#0a0a0a] rounded-lg">
                      <div className="w-7 h-7 rounded border border-gray-700" style={{ backgroundColor: mat.color }} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{mat.name}</div>
                        <div className="text-xs opacity-40">{mat.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="font-mono text-xs tracking-wider opacity-50 uppercase mb-3">Colors</h4>
                <div className="flex flex-wrap gap-2">
                  {colors.slice(0, 8).map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-lg border-2 border-gray-700 cursor-pointer hover:border-white transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`w-full py-4 rounded-lg font-mono text-sm tracking-wider transition-all
                ${uploadResult 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white text-black hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-500'}`}
            >
              {isUploading ? 'UPLOADING...' : uploadResult ? '✓ UPLOADED' : 'UPLOAD TO CATALOG'}
            </button>

            {isUploading && (
              <div className="mt-4 h-1 bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          {uploadResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="font-mono text-xs tracking-wider text-emerald-400 uppercase mb-2">✓ Upload Complete</h3>
              <p className="text-sm text-emerald-300 mb-3">Model added to /{category}/</p>
              <div className="bg-black/30 p-3 rounded-lg font-mono text-xs break-all text-emerald-200">
                {uploadResult.url}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(uploadResult.url)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg font-mono text-xs hover:bg-emerald-500 transition-colors"
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
