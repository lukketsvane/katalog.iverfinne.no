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
  thumbnail?: string;
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
  const [activeTab, setActiveTab] = useState<'upload' | 'browse' | 'bulk'>('upload');
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
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('rotate');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [manualPositionSet, setManualPositionSet] = useState(false);
  
  // Bulk processing state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentFile: string }>({ current: 0, total: 0, currentFile: '' });
  const [bulkResults, setBulkResults] = useState<{ name: string; success: boolean; error?: string }[]>([]);
  
  // Viewer controls state
  const [light1On, setLight1On] = useState(true);
  const [light2On, setLight2On] = useState(true);
  const [light3On, setLight3On] = useState(true);
  const [gridVisible, setGridVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Light direction state (azimuth angle in degrees)
  const [light1Angle, setLight1Angle] = useState(45);
  const [light2Angle, setLight2Angle] = useState(225);
  const [light3Angle, setLight3Angle] = useState(180);
  
  // Edit mode viewer refs
  const editContainerRef = useRef<HTMLDivElement>(null);
  const editSceneRef = useRef<THREE.Scene | null>(null);
  const editModelRef = useRef<THREE.Group | null>(null);
  const editRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const editCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const editOrbitControlsRef = useRef<OrbitControls | null>(null);
  const editTransformControlsRef = useRef<TransformControls | null>(null);
  const [editTransformMode, setEditTransformMode] = useState<'translate' | 'rotate' | 'scale'>('rotate');
  const [editManualPositionSet, setEditManualPositionSet] = useState(false);
  const editTransformModeRef = useRef<'translate' | 'rotate' | 'scale'>('rotate');
  const editManualPositionSetRef = useRef(false);
  const editOriginalBBoxRef = useRef<THREE.Box3 | null>(null);
  const editPreviewScaleRef = useRef<number>(1);
  const [editTargetHeight, setEditTargetHeight] = useState<number | ''>('');
  const [editScaleFactor, setEditScaleFactor] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const originalBBoxRef = useRef<THREE.Box3 | null>(null);
  const transformModeRef = useRef<'translate' | 'rotate' | 'scale'>('rotate');
  const manualPositionSetRef = useRef(false);
  
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

  // Snap model bottom to ground (skip if manual position is set and in translate mode)
  const snapToGround = useCallback((model: THREE.Group, skipSnap?: boolean) => {
    if (skipSnap) return;
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
    scene.background = new THREE.Color(0xffffff);
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
    const gridHelper = new THREE.GridHelper(4, 20, 0xcccccc, 0xdddddd);
    gridHelper.visible = false;
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
          // If in translate mode and user dragged, mark as manual position set
          if (transformModeRef.current === 'translate') {
            manualPositionSetRef.current = true;
            setManualPositionSet(true);
          }
          // Snap to ground after transform (skip if manual position set in translate mode)
          const skipSnap = manualPositionSetRef.current && transformModeRef.current === 'translate';
          snapToGround(model, skipSnap);
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
    transformModeRef.current = transformMode;
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

  // Update light 1 (key light) direction
  useEffect(() => {
    if (keyLightRef.current) {
      const rad = (light1Angle * Math.PI) / 180;
      const distance = 8;
      keyLightRef.current.position.x = Math.cos(rad) * distance;
      keyLightRef.current.position.z = Math.sin(rad) * distance;
    }
  }, [light1Angle]);

  // Update light 2 (fill light) direction
  useEffect(() => {
    if (fillLightRef.current) {
      const rad = (light2Angle * Math.PI) / 180;
      const distance = 5;
      fillLightRef.current.position.x = Math.cos(rad) * distance;
      fillLightRef.current.position.z = Math.sin(rad) * distance;
    }
  }, [light2Angle]);

  // Update light 3 (rim light) direction
  useEffect(() => {
    if (rimLightRef.current) {
      const rad = (light3Angle * Math.PI) / 180;
      const distance = 5;
      rimLightRef.current.position.x = Math.cos(rad) * distance;
      rimLightRef.current.position.z = Math.sin(rad) * distance;
    }
  }, [light3Angle]);

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
    setThumbnailDataUrl(null);
    setManualPositionSet(false);
    manualPositionSetRef.current = false;

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

  // Initialize 3D viewer when editing an item
  useEffect(() => {
    if (!editingItem || !editContainerRef.current) return;

    // Cleanup existing
    if (editTransformControlsRef.current) {
      editTransformControlsRef.current.dispose();
    }
    if (editRendererRef.current) {
      editRendererRef.current.dispose();
    }
    editContainerRef.current.innerHTML = '';

    const width = editContainerRef.current.clientWidth;
    const height = editContainerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    editSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 1000);
    camera.position.set(2, 2, 2);
    editCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    editContainerRef.current.appendChild(renderer.domElement);
    editRendererRef.current = renderer;

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    editOrbitControlsRef.current = orbitControls;

    // Add lights
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe6f0ff, 1.5);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    // Grid (hidden by default)
    const gridHelper = new THREE.GridHelper(4, 20, 0xcccccc, 0xdddddd);
    gridHelper.visible = false;
    scene.add(gridHelper);

    // Load model from URL
    const loader = new GLTFLoader();
    loader.load(editingItem.url, (gltf) => {
      const model = gltf.scene;
      editModelRef.current = model;

      // Enable shadows on all meshes
      model.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          (node as THREE.Mesh).castShadow = true;
          (node as THREE.Mesh).receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      editOriginalBBoxRef.current = box.clone();
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center horizontally, snap bottom to ground
      model.position.set(-center.x, -box.min.y, -center.z);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      editPreviewScaleRef.current = scale;
      model.scale.setScalar(scale);

      // Initialize edit target height from metadata if available
      if (editingItem.metadata?.targetHeight) {
        setEditTargetHeight(editingItem.metadata.targetHeight);
      } else {
        setEditTargetHeight('');
      }

      // Re-snap after scaling
      snapToGround(model);

      scene.add(model);

      // Setup transform controls
      const transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.attach(model);
      transformControls.setMode(editTransformModeRef.current);
      scene.add(transformControls);
      editTransformControlsRef.current = transformControls;

      // Disable orbit controls while dragging transform
      transformControls.addEventListener('dragging-changed', (event) => {
        orbitControls.enabled = !event.value;
        if (!event.value) {
          if (editTransformModeRef.current === 'translate') {
            editManualPositionSetRef.current = true;
            setEditManualPositionSet(true);
          }
          const skipSnap = editManualPositionSetRef.current && editTransformModeRef.current === 'translate';
          snapToGround(model, skipSnap);
        }
      });
    });

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (editTransformControlsRef.current) {
        editTransformControlsRef.current.dispose();
      }
      if (editRendererRef.current) {
        editRendererRef.current.dispose();
      }
      editSceneRef.current = null;
      editModelRef.current = null;
      editRendererRef.current = null;
      editCameraRef.current = null;
      editOrbitControlsRef.current = null;
      editTransformControlsRef.current = null;
    };
  }, [editingItem?.id, snapToGround]);

  // Update edit transform mode
  useEffect(() => {
    if (editTransformControlsRef.current) {
      editTransformControlsRef.current.setMode(editTransformMode);
    }
    editTransformModeRef.current = editTransformMode;
  }, [editTransformMode]);

  // Calculate edit scale factor when target height changes
  useEffect(() => {
    if (editTargetHeight && editOriginalBBoxRef.current) {
      const originalHeight = editOriginalBBoxRef.current.max.y - editOriginalBBoxRef.current.min.y;
      setEditScaleFactor(Number(editTargetHeight) / originalHeight);
    } else {
      setEditScaleFactor(null);
    }
  }, [editTargetHeight]);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  // Auto-crop transparent image to remove empty space around subject
  const autoCropImage = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasContent = false;

    // Find bounding box of non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) { // Threshold for considering a pixel as content
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasContent) return canvas.toDataURL('image/png');

    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;

    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return canvas.toDataURL('image/png');

    croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return croppedCanvas.toDataURL('image/png');
  };

  // Capture thumbnail with transparent background and auto-crop
  const captureThumbnail = (): string | null => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;

    // Save current background
    const originalBackground = sceneRef.current.background;
    
    // Temporarily hide transform controls and grid for clean screenshot
    if (transformControlsRef.current) {
      transformControlsRef.current.visible = false;
    }
    const gridWasVisible = gridRef.current?.visible;
    if (gridRef.current) {
      gridRef.current.visible = false;
    }

    // Set transparent background
    sceneRef.current.background = null;

    // Render a frame
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // Get the canvas and auto-crop
    const thumbnailDataUrl = autoCropImage(rendererRef.current.domElement);

    // Restore settings
    sceneRef.current.background = originalBackground;
    if (transformControlsRef.current) {
      transformControlsRef.current.visible = true;
    }
    if (gridRef.current && gridWasVisible !== undefined) {
      gridRef.current.visible = gridWasVisible;
    }

    // Re-render with original settings
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    return thumbnailDataUrl;
  };

  const analyzeWithAI = async () => {
    if (!rendererRef.current) return;

    setIsAnalyzing(true);

    try {
      // Capture thumbnail with transparent background and auto-crop
      const thumbnailResult = captureThumbnail();
      if (thumbnailResult) {
        setThumbnailDataUrl(thumbnailResult);
      }

      // For AI analysis, we need the full screenshot (not cropped) with background for context
      // Temporarily hide transform controls for clean screenshot
      if (transformControlsRef.current) {
        transformControlsRef.current.visible = false;
      }
      
      // Render a frame without controls
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      const screenshotDataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const screenshot = screenshotDataUrl.split(',')[1];

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
      
      // Get the current scale from the model (preview scale)
      const currentScale = modelRef.current.scale.clone();
      
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

      // Reset the export scene transform since geometry is already baked
      exportScene.position.set(0, 0, 0);
      exportScene.rotation.set(0, 0, 0);
      exportScene.scale.set(1, 1, 1);

      // Apply scale factor uniformly if set (for real-world dimensions)
      if (scaleFactor && originalBBoxRef.current) {
        // The scaleFactor is relative to original model, but geometry is already baked with preview scale
        // So we need to apply: (scaleFactor / currentScale) to get correct final size
        const finalScale = scaleFactor / currentScale.x;
        exportScene.scale.setScalar(finalScale);
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
        thumbnail: thumbnailDataUrl || undefined,
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

  // Bulk process a single file
  const processSingleFile = async (
    fileToProcess: File,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) {
          resolve({ success: false, error: 'Failed to read file' });
          return;
        }

        try {
          const arrayBuffer = e.target.result as ArrayBuffer;
          const loader = new GLTFLoader();
          const blob = new Blob([arrayBuffer]);
          const url = URL.createObjectURL(blob);

          loader.load(url, async (gltf) => {
            try {
              const model = gltf.scene;

              // Enable shadows on all meshes
              model.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                  (node as THREE.Mesh).castShadow = true;
                  (node as THREE.Mesh).receiveShadow = true;
                }
              });

              // Center and scale model
              const box = new THREE.Box3().setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              model.position.set(-center.x, -box.min.y, -center.z);
              const maxDim = Math.max(size.x, size.y, size.z);
              const scale = 2 / maxDim;
              model.scale.setScalar(scale);

              // Snap to ground
              const newBox = new THREE.Box3().setFromObject(model);
              model.position.y -= newBox.min.y;

              // Add to scene
              scene.add(model);

              // Position camera
              camera.position.set(2, 2, 2);
              camera.lookAt(0, 0.5, 0);

              // Render for thumbnail (with transparent background)
              const originalBackground = scene.background;
              scene.background = null;
              renderer.render(scene, camera);
              const thumbnailCanvas = renderer.domElement;
              const thumbnail = autoCropImage(thumbnailCanvas);
              scene.background = originalBackground;

              // Render for AI (with background)
              renderer.render(scene, camera);
              const screenshotDataUrl = renderer.domElement.toDataURL('image/png');
              const screenshot = screenshotDataUrl.split(',')[1];

              // Extract materials
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

              // Call AI for analysis
              let aiData: { name?: string; heightMm?: number; tags?: string[]; category?: string; description?: string } = {};
              try {
                const response = await fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    image: screenshot,
                    materials: mats.map((m) => ({
                      name: m.name,
                      type: m.type,
                      color: m.color,
                      metalness: m.metalness,
                      roughness: m.roughness,
                    })),
                  }),
                });
                aiData = await response.json();
              } catch (err) {
                console.error('AI analysis failed for bulk item:', err);
              }

              const itemName = aiData.name || fileToProcess.name.replace(/\.(glb|gltf)$/i, '');
              const itemCategory = aiData.category || 'misc';
              const itemTags = aiData.tags || [];
              const itemHeight = aiData.heightMm || null;
              const itemDescription = aiData.description || '';

              // Calculate scale factor
              const originalHeight = box.max.y - box.min.y;
              const itemScaleFactor = itemHeight ? itemHeight / originalHeight : null;

              // Export model
              const exportScene = model.clone();
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

              exportScene.position.set(0, 0, 0);
              exportScene.rotation.set(0, 0, 0);
              exportScene.scale.set(1, 1, 1);

              if (itemScaleFactor) {
                const finalScale = itemScaleFactor / scale;
                exportScene.scale.setScalar(finalScale);
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
              const safeName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
              const filename = `${safeName}-${Date.now()}.glb`;
              const pathname = `${itemCategory}/${filename}`;

              const result = await upload(pathname, uploadBlob, {
                access: 'public',
                handleUploadUrl: '/api/upload/token',
              });

              const catalogItem: CatalogItem = {
                id: Date.now() + Math.random(),
                name: itemName,
                url: result.url,
                type: '3d',
                category: itemCategory,
                tags: itemTags,
                thumbnail,
                metadata: {
                  materials: mats,
                  colors: cols,
                  targetHeight: itemHeight,
                  scaleFactor: itemScaleFactor,
                  description: itemDescription,
                  uploadedAt: new Date().toISOString(),
                },
              };

              const existing = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
              existing.items.push(catalogItem);
              localStorage.setItem('katalog-config', JSON.stringify(existing));
              setCatalogItems(existing.items);

              // Remove model from scene
              scene.remove(model);
              URL.revokeObjectURL(url);

              resolve({ success: true });
            } catch (err) {
              console.error('Error processing model:', err);
              resolve({ success: false, error: String(err) });
            }
          }, undefined, (error) => {
            resolve({ success: false, error: String(error) });
          });
        } catch (err) {
          resolve({ success: false, error: String(err) });
        }
      };
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file' });
      reader.readAsArrayBuffer(fileToProcess);
    });
  };

  // Bulk process all files
  const processBulkFiles = async () => {
    if (bulkFiles.length === 0) return;

    setBulkProcessing(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: bulkFiles.length, currentFile: '' });

    // Create off-screen renderer for bulk processing
    const width = 512;
    const height = 512;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 1000);
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Add lights
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe6f0ff, 1.5);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      setBulkProgress({ current: i + 1, total: bulkFiles.length, currentFile: file.name });

      const result = await processSingleFile(file, scene, camera, renderer);
      results.push({ name: file.name, ...result });
      setBulkResults([...results]);
    }

    renderer.dispose();
    setBulkProcessing(false);
    setBulkFiles([]);
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
            onClick={() => setActiveTab('bulk')}
            className={`text-xs transition ${activeTab === 'bulk' ? 'text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Bulk
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
                  <button
                    onClick={() => setTransformMode('scale')}
                    className={`px-3 py-1.5 text-xs rounded transition ${
                      transformMode === 'scale' 
                        ? 'bg-white text-black' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Scale
                  </button>
                  {manualPositionSet && (
                    <button
                      onClick={() => {
                        setManualPositionSet(false);
                        manualPositionSetRef.current = false;
                        if (modelRef.current) {
                          snapToGround(modelRef.current);
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-500 transition"
                      title="Re-enable ground snapping"
                    >
                      Snap
                    </button>
                  )}
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

            {/* Light Direction Controls */}
            {file && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="text-xs text-neutral-400 mb-3">Light Directions</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-12">Key</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={light1Angle}
                      onChange={(e) => setLight1Angle(Number(e.target.value))}
                      className="flex-1 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      disabled={!light1On}
                    />
                    <span className="text-xs text-neutral-500 w-8">{light1Angle}°</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-12">Fill</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={light2Angle}
                      onChange={(e) => setLight2Angle(Number(e.target.value))}
                      className="flex-1 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      disabled={!light2On}
                    />
                    <span className="text-xs text-neutral-500 w-8">{light2Angle}°</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-12">Rim</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={light3Angle}
                      onChange={(e) => setLight3Angle(Number(e.target.value))}
                      className="flex-1 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      disabled={!light3On}
                    />
                    <span className="text-xs text-neutral-500 w-8">{light3Angle}°</span>
                  </div>
                </div>
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

            {/* Thumbnail Preview */}
            {file && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="text-xs text-neutral-400 mb-2">Thumbnail</div>
                <div className="flex gap-3 items-start">
                  <div 
                    className="w-20 h-20 rounded border border-neutral-700 overflow-hidden flex items-center justify-center"
                    style={{ background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 10px 10px' }}
                  >
                    {thumbnailDataUrl ? (
                      <img src={thumbnailDataUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-neutral-600 text-[10px]">No thumbnail</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const thumbnail = captureThumbnail();
                        if (thumbnail) setThumbnailDataUrl(thumbnail);
                      }}
                      className="px-3 py-1.5 text-xs bg-neutral-800 rounded hover:bg-neutral-700 transition"
                    >
                      Capture
                    </button>
                    <label className="px-3 py-1.5 text-xs bg-neutral-800 rounded hover:bg-neutral-700 transition cursor-pointer text-center">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setThumbnailDataUrl(ev.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {thumbnailDataUrl && (
                      <button
                        onClick={() => setThumbnailDataUrl(null)}
                        className="px-3 py-1.5 text-xs bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
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
      ) : activeTab === 'bulk' ? (
        /* Bulk Processing Tab */
        <main className="max-w-4xl mx-auto p-6">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-mono text-lg mb-2">Bulk Processing</h2>
              <p className="text-sm text-neutral-400">Upload multiple GLB files to process them automatically with AI</p>
            </div>

            {/* Drop zone for multiple files */}
            <div
              className={`bg-neutral-900 border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                ${bulkFiles.length > 0 ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-neutral-500'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter(
                  f => f.name.endsWith('.glb') || f.name.endsWith('.gltf')
                );
                setBulkFiles(prev => [...prev, ...files]);
              }}
              onClick={() => document.getElementById('bulkFileInput')?.click()}
            >
              <svg className="w-12 h-12 mx-auto mb-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="font-mono text-sm text-neutral-400 mb-2">
                Drop multiple GLB/GLTF files here
              </p>
              <p className="text-xs text-neutral-600">or click to select files</p>
              <input
                id="bulkFileInput"
                type="file"
                accept=".glb,.gltf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).filter(
                    f => f.name.endsWith('.glb') || f.name.endsWith('.gltf')
                  );
                  setBulkFiles(prev => [...prev, ...files]);
                }}
              />
            </div>

            {/* File list */}
            {bulkFiles.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-neutral-400">{bulkFiles.length} files selected</span>
                  <button
                    onClick={() => setBulkFiles([])}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bulkFiles.map((f, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-black rounded">
                      <span className="text-xs truncate flex-1">{f.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button
                        onClick={() => setBulkFiles(bulkFiles.filter((_, j) => j !== i))}
                        className="ml-2 text-neutral-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Process button */}
            <button
              onClick={processBulkFiles}
              disabled={bulkFiles.length === 0 || bulkProcessing}
              className="w-full py-4 rounded-lg font-medium text-sm bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 transition-all"
            >
              {bulkProcessing ? `Processing ${bulkProgress.current}/${bulkProgress.total}...` : `Process ${bulkFiles.length} Files`}
            </button>

            {/* Progress */}
            {bulkProcessing && (
              <div className="space-y-2">
                <div className="h-2 bg-neutral-800 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all" 
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} 
                  />
                </div>
                <p className="text-xs text-neutral-400 text-center">
                  Processing: {bulkProgress.currentFile}
                </p>
              </div>
            )}

            {/* Results */}
            {bulkResults.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Results</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bulkResults.map((result, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center gap-2 p-2 rounded ${
                        result.success ? 'bg-green-900/20' : 'bg-red-900/20'
                      }`}
                    >
                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                        {result.success ? '✓' : '✗'}
                      </span>
                      <span className="text-xs flex-1 truncate">{result.name}</span>
                      {result.error && (
                        <span className="text-xs text-red-400 truncate max-w-32">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
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
                  <div className="aspect-square bg-neutral-800 flex items-center justify-center overflow-hidden">
                    {item.thumbnail ? (
                      <img 
                        src={item.thumbnail} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-neutral-600 text-xs font-mono">3D</span>
                    )}
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
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-mono text-sm">Edit Item</h3>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="text-neutral-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 3D Viewer */}
                  <div className="space-y-3">
                    <div
                      ref={editContainerRef}
                      className="bg-black rounded-lg aspect-video overflow-hidden border border-neutral-800"
                    />
                    
                    {/* Transform controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditTransformMode('rotate')}
                        className={`px-3 py-1.5 text-xs rounded transition ${
                          editTransformMode === 'rotate' 
                            ? 'bg-white text-black' 
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        Rotate
                      </button>
                      <button
                        onClick={() => setEditTransformMode('translate')}
                        className={`px-3 py-1.5 text-xs rounded transition ${
                          editTransformMode === 'translate' 
                            ? 'bg-white text-black' 
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        Move
                      </button>
                      <button
                        onClick={() => setEditTransformMode('scale')}
                        className={`px-3 py-1.5 text-xs rounded transition ${
                          editTransformMode === 'scale' 
                            ? 'bg-white text-black' 
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        Scale
                      </button>
                      {editManualPositionSet && (
                        <button
                          onClick={() => {
                            setEditManualPositionSet(false);
                            if (editModelRef.current) {
                              snapToGround(editModelRef.current);
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-500 transition"
                        >
                          Snap
                        </button>
                      )}
                    </div>
                    
                    {/* Thumbnail section */}
                    <div className="bg-neutral-800 rounded-lg p-3">
                      <div className="text-xs text-neutral-400 mb-2">Thumbnail</div>
                      <div className="flex gap-3 items-start">
                        <div 
                          className="w-16 h-16 rounded border border-neutral-700 overflow-hidden flex items-center justify-center"
                          style={{ background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 10px 10px' }}
                        >
                          {editingItem.thumbnail ? (
                            <img src={editingItem.thumbnail} alt="Thumbnail" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-neutral-600 text-[10px]">None</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => {
                              if (editRendererRef.current && editSceneRef.current && editCameraRef.current) {
                                // Hide transform controls
                                if (editTransformControlsRef.current) {
                                  editTransformControlsRef.current.visible = false;
                                }
                                // Transparent background
                                const origBg = editSceneRef.current.background;
                                editSceneRef.current.background = null;
                                editRendererRef.current.render(editSceneRef.current, editCameraRef.current);
                                const thumbnail = autoCropImage(editRendererRef.current.domElement);
                                // Restore
                                editSceneRef.current.background = origBg;
                                if (editTransformControlsRef.current) {
                                  editTransformControlsRef.current.visible = true;
                                }
                                editRendererRef.current.render(editSceneRef.current, editCameraRef.current);
                                setEditingItem({ ...editingItem, thumbnail });
                              }
                            }}
                            className="px-2 py-1 text-[10px] bg-neutral-700 rounded hover:bg-neutral-600 transition"
                          >
                            Capture
                          </button>
                          <label className="px-2 py-1 text-[10px] bg-neutral-700 rounded hover:bg-neutral-600 transition cursor-pointer text-center">
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if (ev.target?.result) {
                                      setEditingItem({ ...editingItem, thumbnail: ev.target.result as string });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Form fields */}
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
                    
                    {/* Height/Scale input */}
                    <div className="bg-neutral-800 rounded-lg p-3">
                      <div className="text-xs text-neutral-400 mb-2">Target Height (uniform scale)</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={editTargetHeight}
                          onChange={(e) => setEditTargetHeight(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Height"
                          className="flex-1 px-3 py-2 bg-black border border-neutral-700 rounded text-sm focus:outline-none focus:border-neutral-500"
                        />
                        <span className="px-3 py-2 bg-neutral-700 rounded text-xs text-neutral-400">mm</span>
                      </div>
                      {editScaleFactor && (
                        <div className="mt-2 text-xs text-amber-400 font-mono">{editScaleFactor.toFixed(4)}x scale</div>
                      )}
                    </div>
                    
                    <div className="bg-neutral-800 rounded-lg p-3">
                      <div className="text-xs text-neutral-400 mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {editingItem.tags.map((tag, i) => (
                          <span key={i} className="bg-neutral-700 px-2 py-1 rounded text-xs flex items-center gap-1.5">
                            {tag}
                            <button 
                              onClick={() => setEditingItem({ 
                                ...editingItem, 
                                tags: editingItem.tags.filter((_, j) => j !== i) 
                              })} 
                              className="text-neutral-400 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {editingItem.metadata?.description && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-xs text-blue-300">{editingItem.metadata.description}</p>
                      </div>
                    )}
                    
                    <div className="text-xs text-neutral-500">
                      <p>URL: <span className="font-mono text-neutral-400 break-all">{editingItem.url}</span></p>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          const updatedItem = {
                            ...editingItem,
                            metadata: {
                              ...editingItem.metadata,
                              targetHeight: editTargetHeight || null,
                              scaleFactor: editScaleFactor,
                            }
                          };
                          updateItem(updatedItem);
                        }}
                        className="flex-1 py-2 bg-white text-black rounded text-sm hover:bg-neutral-200 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => deleteItem(editingItem.id)}
                        className="px-4 py-2 bg-red-900/30 text-red-400 rounded text-sm hover:bg-red-900/50 transition"
                      >
                        Delete
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
            </div>
          )}
        </main>
      )}
    </div>
  );
}
