# KATALOG

A minimal catalog for viewing 3D models and everyday objects.

**Live:** https://katalog.iverfinne.no

Inspired by [Barbara Iweins' Katalog](https://katalog-barbaraiweins.com/)

## Features

- 📦 Grid view of 3D models from Vercel Blob storage
- 🔍 Search and filter by category
- 📐 Adjustable grid size (small/medium/large)
- 🖼️ Modal view with interactive 3D preview
- 🔄 Auto-rotating thumbnails
- 📱 Responsive design

## Categories

- Furniture (chairs, tables, lamps, storage)
- Electronics
- Kitchen
- Clothing
- Toys
- Tools
- Art & Decor
- Personal
- Miscellaneous

## Development

```bash
npm install
npm run dev
```

## Environment Variables

Set in Vercel dashboard or `.env.local`:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

## Deploy

Push to the `main` branch → auto-deploys to Vercel.

## Related

- **Upload Portal:** https://katalog-upload.iverfinne.no
- **Source:** https://github.com/lukketsvane/katalog.iverfinne.no

## Tech Stack

- Next.js 14 (App Router)
- Three.js (3D rendering)
- Vercel Blob (storage)
- Tailwind CSS
