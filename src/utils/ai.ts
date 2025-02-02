import { ElevenLabsClient } from './elevenlabs';
import vision from '@google-cloud/vision';
import { join } from 'path';

// ElevenLabs APIクライアントの初期化
const elevenLabs = new ElevenLabsClient('sk_1a371cf5a94aeb6f56866d5dce21074f2e662523a557482c');

// Google Cloud Vision APIクライアントの初期化
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: join(process.cwd(), 'ai-agent-449514-5661891e7e24.json'),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'ai-agent-449514'
});

// 危険な状況の定義
const DANGEROUS_SITUATIONS = {
  // 道具関連
  'shovel': '危険な道具の使用',
  'knife': '危険な刃物の使用',
  'scissors': 'はさみの使用',
  'tool': '道具の使用',
  'ladder': 'はしごの使用',
  
  // 姿勢・動作関連
  'falling': '転倒',
  'lying': '倒れている',
  'sitting': '不安定な姿勢',
  'bending': '前かがみの姿勢',
  'reaching': '無理な体勢',
  
  // 場所関連
  'stairs': '階段での行動',
  'kitchen': '台所での作業',
  'bathroom': '浴室での行動',
  
  // 状況関連
  'alone': '一人での危険な作業',
  'dark': '暗い場所での作業',
  'wet': '濡れた場所での作業'
};

// 危険度を評価する関数
function evaluateDanger(
  objects: string[],
  labels: string[],
  safeSearch: any
): { isDangerous: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const allDetections = [...objects, ...labels].map(item => item.toLowerCase());

  // SafeSearch結果の確認
  if (safeSearch) {
    if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.violence)) {
      reasons.push('危険な行動が検出されました');
    }
    if (['LIKELY', 'VERY_LIKELY'].includes(safeSearch.medical)) {
      reasons.push('医療的な危険が検出されました');
    }
  }

  // 特定の組み合わせの検出
  const hasTools = allDetections.some(item => ['shovel', 'tool', 'knife', 'scissors'].includes(item));
  const isAlone = allDetections.includes('person') && objects.filter(obj => obj.toLowerCase() === 'person').length === 1;
  
  if (hasTools && isAlone) {
    reasons.push('一人での危険な道具の使用');
  }

  // 個別の危険要因の検出
  for (const [keyword, situation] of Object.entries(DANGEROUS_SITUATIONS)) {
    if (allDetections.some(item => item.includes(keyword))) {
      reasons.push(situation);
    }
  }

  return {
    isDangerous: reasons.length > 0,
    reasons
  };
}

export async function analyzeImage(imageData: ArrayBuffer): Promise<{
  isDangerous: boolean;
  situation?: string;
}> {
  try {
    const base64Image = Buffer.from(imageData).toString('base64');
    
    console.log('Calling Vision API...');
    const [result] = await visionClient.annotateImage({
      image: {
        content: base64Image
      },
      features: [
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'LABEL_DETECTION' },
        { type: 'TEXT_DETECTION' },
        { type: 'SAFE_SEARCH_DETECTION' }
      ]
    });

    console.log('Vision API Results:', {
      objects: result.localizedObjectAnnotations?.map(obj => obj.name),
      labels: result.labelAnnotations?.map(label => label.description),
      safeSearch: result.safeSearchAnnotation
    });

    const objects = (result.localizedObjectAnnotations || []).map(obj => obj.name || '');
    const labels = (result.labelAnnotations || []).map(label => label.description || '');

    const dangerEvaluation = evaluateDanger(
      objects,
      labels,
      result.safeSearchAnnotation
    );

    console.log('Danger evaluation:', dangerEvaluation);

    return {
      isDangerous: dangerEvaluation.isDangerous,
      situation: dangerEvaluation.reasons.join('、')
    };
  } catch (error) {
    console.error('Error analyzing image with Vision API:', error);
    throw error;
  }
}

export async function generateWarningAudio(situation: string): Promise<ArrayBuffer> {
  const warningMessage = `注意！${situation}が検出されました。すぐに確認してください。`;
  return await elevenLabs.generateSpeech(warningMessage);
}
