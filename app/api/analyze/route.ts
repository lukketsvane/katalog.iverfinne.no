import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

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
1. A list of 5-8 descriptive tags for cataloging (single words or short phrases)
2. Identify the primary materials visible (wood, metal, plastic, fabric, ceramic, glass, etc.)
3. Describe the dominant colors (use simple color names)
4. Suggest the best category from this list: ${CATEGORIES.join(', ')}
5. A brief one-sentence description

Respond ONLY with valid JSON in this exact format, no markdown:
{
  "tags": ["tag1", "tag2"],
  "materials": ["material1", "material2"],
  "colors": ["red", "blue"],
  "category": "furniture/chairs",
  "description": "Brief one-sentence description"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: {
        thinkingConfig: {
          thinkingLevel: 'HIGH',
        },
      },
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
