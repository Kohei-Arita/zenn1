import { NextRequest, NextResponse } from 'next/server';
import { runPythonScript } from '@/utils/python_runner';

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
      // Convert image to ArrayBuffer and then to Buffer
      const imageBuffer = Buffer.from(await image.arrayBuffer());
      
      console.log('Analyzing image...');
      // Analyze image using Python script
      const analysisResult = await runPythonScript(
        'gemini_analysis',
        'GeminiAnalyzer().analyze_image',
        [imageBuffer]
      );

      if (!analysisResult.success) {
        throw new Error(analysisResult.error);
      }

      const analysis = analysisResult.data;
      console.log('Analysis completed:', analysis);

      // Generate descriptive text
      const textToSpeak = `${analysis.activity}\n${analysis.environment}\n${analysis.informative_message}`;
      
      // Generate audio using Python script
      console.log('Generating descriptive audio...');
      const audioResult = await runPythonScript(
        'elevenlabs_tts',
        'ElevenLabsClient().generate_speech',
        [textToSpeak]
      );

      if (!audioResult.success) {
        throw new Error(audioResult.error);
      }

      // Convert base64 audio content back to Buffer
      const audioContent = Buffer.from(audioResult.data, 'base64');
      console.log('Audio generated, size:', audioContent.length);
      
      // Return audio content with appropriate headers
      return new NextResponse(audioContent, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioContent.length.toString(),
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
