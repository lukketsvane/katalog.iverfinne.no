import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the pathname and return token payload
        return {
          allowedContentTypes: ['model/gltf-binary', 'application/octet-stream'],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB limit
          tokenPayload: JSON.stringify({
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after the file has been uploaded to Vercel Blob
        console.log('Upload completed:', blob.url);
        try {
          const payload = JSON.parse(tokenPayload || '{}');
          console.log('Token payload:', payload);
        } catch {
          // Ignore JSON parse errors
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
