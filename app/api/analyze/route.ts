import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';

// Extend timeout to 60 seconds for Vercel Hobby plan
export const maxDuration = 60;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const CATEGORIES = [
  'furniture/chairs',
  'furniture/tables', 
  'furniture/lamps',
  'furniture/storage',
  'electronics',
  'kitchen',
  'clothing',
  'toys',
  'tools',
  'art',
  'personal',
  'misc',
];

export async function POST(request: Request) {
  try {
    const { image, materials } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const prompt = `Analyze this 3D model render. I have extracted these materials from the GLB file:

${JSON.stringify(materials, null, 2)}

Based on the image and material data, please provide:
1. A suggested name for this object (short, descriptive, 1-3 words)
2. Estimate the real-world height of this object in millimeters (mm). Use common sense for typical objects.
3. A list of 5-8 descriptive tags for cataloging (single words or short phrases)
4. Identify the primary materials visible (wood, metal, plastic, fabric, ceramic, glass, etc.)
5. Describe the dominant colors (use simple color names)
6. Suggest the best category from this list: ${CATEGORIES.join(', ')}
7. A brief one-sentence description

Respond ONLY with valid JSON in this exact format, no markdown:
{
  "name": "Object Name",
  "heightMm": 450,
  "tags": ["tag1", "tag2"],
  "materials": ["material1", "material2"],
  "colors": ["red", "blue"],
  "category": "furniture/chairs",
  "description": "Brief one-sentence description"
}`;

    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: image,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const text = response.text || '';
    
    // Parse JSON from response
    let jsonStr = text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const analysis = JSON.parse(jsonStr.trim());
    
    // Validate category
    if (!CATEGORIES.includes(analysis.category)) {
      analysis.category = 'misc';
    }

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Also export categories for the frontend
export async function GET() {
  return NextResponse.json({ categories: CATEGORIES });
}
