import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, generateDescriptiveAudio } from '@/utils/ai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Check file type
    if (!image.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image file' },
        { status: 400 }
      );
    }

    try {
      // Convert image to ArrayBuffer
      const imageBuffer = await image.arrayBuffer();
      
      console.log('Analyzing image...');
      // Analyze image using Vertex AI
      const analysis = await analyzeImage(imageBuffer);
      console.log('Analysis completed:', analysis);
      
      // Generate descriptive audio using ElevenLabs
      console.log('Generating descriptive audio...');
      const audioContent = await generateDescriptiveAudio(analysis);
      console.log('Audio generated, size:', audioContent.byteLength);
      
      // Return audio content with appropriate headers
      return new NextResponse(audioContent, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioContent.byteLength.toString(),
          'Cache-Control': 'no-cache',
          'Content-Disposition': 'inline'
        },
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process image' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
