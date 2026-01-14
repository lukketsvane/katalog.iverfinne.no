# KATALOG Upload Portal

**Live:** [katalog-upload.iverfinne.no](http://katalog-upload.iverfinne.no)

Upload portal for 3D models (GLB/GLTF) with AI-powered material analysis using Gemini 3.

## Features

- 📦 Drag & drop GLB/GLTF file upload
- 📂 Category-based folder organization
- 📐 Auto-scale models to target height (mm)
- 🤖 AI-powered material and color recognition (Gemini 3 Pro Preview)
- 🎨 Automatic material extraction from GLB
- 🏷️ Smart tagging system
- ☁️ Direct upload to Vercel Blob Storage
- 🖼️ Transparent PNG thumbnail capture with auto-crop
- 📦 Bulk processing with AI analysis

## Data Structure for Frontend Viewer

### Catalog Item Schema

Items are stored in `localStorage` under key `katalog-config`:

```typescript
interface CatalogItem {
  id: number;                    // Unique timestamp-based ID
  name: string;                  // Display name
  url: string;                   // Vercel Blob URL to GLB file
  type: string;                  // Always "3d"
  category: string;              // Category path (e.g., "furniture/chairs")
  tags: string[];                // Array of lowercase tags
  thumbnail?: string;            // Base64 data URL (PNG with transparency)
  metadata: {
    materials?: MaterialInfo[];  // Extracted material data
    colors?: string[];           // Hex color codes from model
    targetHeight?: number | null; // Target height in mm
    scaleFactor?: number | null;  // Scale multiplier for real-world size
    description?: string;         // AI-generated description
    uploadedAt?: string;          // ISO 8601 timestamp
  };
}

interface MaterialInfo {
  name: string;      // Material name
  type: string;      // Material type (e.g., "MeshStandard")
  color: string;     // Hex color (e.g., "#ff0000")
  metalness: number; // 0-1
  roughness: number; // 0-1
}
```

### File Paths

| Type | Path Pattern | Example |
|------|--------------|---------|
| GLB Model | `{category}/{safename}-{timestamp}.glb` | `furniture/chairs/office-chair-1704067200000.glb` |
| Thumbnail | Embedded as base64 data URL | `data:image/png;base64,...` |

### URL Structure

- **Blob Storage:** `https://*.public.blob.vercel-storage.com/{category}/{filename}.glb`
- **Thumbnails:** Stored inline as base64 PNG with transparent background

### Reading Catalog Data

```javascript
const catalog = JSON.parse(localStorage.getItem('katalog-config') || '{"items":[]}');
const items = catalog.items; // Array of CatalogItem
```

### Scaling Logic

When `targetHeight` (mm) is set:
```javascript
// scaleFactor = targetHeight / originalModelHeight
// Apply to model: model.scale.setScalar(scaleFactor)
```

## Folder Structure

```
3d-files/
├── furniture/
│   ├── chairs/
│   ├── tables/
│   ├── lamps/
│   └── storage/
├── electronics/
├── kitchen/
├── clothing/
├── toys/
├── tools/
├── art/
├── personal/
└── misc/
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/lukketsvane/katalog.iverfinne.no.git
cd katalog.iverfinne.no
git checkout upload
npm install
```

### 2. Environment Variables

Create `.env.local` with:

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_YswMt0em8HYvljdK_..."
GEMINI_API_KEY="AIza..."
```

**Vercel Blob Token:** Already configured in your Vercel project.

**Gemini API Key:** Get from [ai.google.dev](https://ai.google.dev/)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy

Push to the `upload` branch - Vercel will auto-deploy to `katalog-upload.iverfinne.no`

```bash
git add .
git commit -m "Update upload portal"
git push origin upload
```

## Vercel Project Settings

In your Vercel dashboard:

1. Go to **Settings** → **Domains**
2. Add `katalog-upload.iverfinne.no` 
3. Set **Git Branch** to `upload`

This creates a branch-based deployment where:
- `main` branch → `katalog.iverfinne.no`
- `upload` branch → `katalog-upload.iverfinne.no`

## Environment Variables in Vercel

Add these in **Settings** → **Environment Variables**:

| Variable | Value |
|----------|-------|
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_YswMt0em8HYvljdK_...` |
| `GEMINI_API_KEY` | Your Google AI API key |

## Tech Stack

- **Next.js 14** (App Router)
- **Three.js** for 3D preview
- **Vercel Blob** for storage
- **Google Gemini 3 Pro Preview** for AI analysis
- **Tailwind CSS** for styling
