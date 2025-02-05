import { NextRequest, NextResponse } from 'next/server';
import { runPythonScript } from '@/utils/python_runner';

interface AnalysisResult {
  environment: string;
  safety: string;
  informative_message: string;
}

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

      // Parse the Python output
      let analysis;
      try {
        analysis = JSON.parse(analysisResult.data);
      } catch (parseError) {
        console.error('Failed to parse analysis result:', analysisResult.data);
        throw new Error('Failed to parse analysis result');
      }
      console.log('Analysis completed:', analysis);

      // Generate audio for informative message
      console.log('Generating descriptive audio...');
      const audioResult = await runPythonScript(
        'elevenlabs_tts',
        'ElevenLabsClient().generate_speech',
        [analysis.informative_message]
      );

      if (!audioResult.success) {
        throw new Error(audioResult.error);
      }

      // Convert base64 audio content back to Buffer
      const audioContent = Buffer.from(audioResult.data, 'base64');
      console.log('Audio generated, size:', audioContent.length);
      
      // Return both analysis results and audio content
      const response = {
        environment: analysis.environment,
        safety: analysis.safety,
        audio: audioContent.toString('base64')
      };
      
      return NextResponse.json(response, { status: 200 });
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
