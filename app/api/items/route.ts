import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const { blobs } = await list({
      limit: 1000,
    });

    // Filter to only GLB/GLTF files, exclude .keep placeholders, and exclude models/ folder
    const modelFiles = blobs.filter(blob => 
      blob.pathname.match(/\.(glb|gltf)$/i) && 
      !blob.pathname.includes('.keep') &&
      !blob.pathname.startsWith('models/')
    );

    // Parse items with metadata
    const items = modelFiles.map(blob => {
      // Extract category from pathname (e.g., "furniture/chairs/model.glb" -> "furniture/chairs")
      const pathParts = blob.pathname.split('/');
      const filename = pathParts.pop() || '';
      const category = pathParts.join('/') || 'misc';
      
      // Extract name from filename (e.g., "eames-chair-1234567890.glb" -> "Eames Chair")
      const nameWithTimestamp = filename.replace(/\.(glb|gltf)$/i, '');
      const nameParts = nameWithTimestamp.split('-');
      // Remove timestamp if it's a number at the end
      if (nameParts.length > 1 && /^\d{10,}$/.test(nameParts[nameParts.length - 1])) {
        nameParts.pop();
      }
      const name = nameParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      return {
        url: blob.url,
        pathname: blob.pathname,
        name: name || 'Unnamed',
        category,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      };
    });

    // Sort by upload date (newest first)
    items.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('Failed to fetch items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items', items: [] },
      { status: 500 }
    );
  }
}
