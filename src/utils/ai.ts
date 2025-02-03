import { ElevenLabsClient } from './elevenlabs';
import vision from '@google-cloud/vision';
import { join } from 'path';

// ElevenLabs APIクライアントの初期化
const elevenLabs = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY || '');

// Google Cloud Vision APIクライアントの初期化
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: join(process.cwd(), 'ai-agent-449514-5661891e7e24.json'),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'ai-agent-449514'
});

interface AnalysisResult {
  activity: string;      // 作業内容の説明
  environment: string;   // 周囲の環境説明
  risks: string[];       // 検出された危険性
  warningMessage: string; // 優しい警告メッセージ
}

// 危険な状況の定義
const DANGEROUS_SITUATIONS = {
  // 道具関連
  'shovel': { risk: '土を掘る作業', message: 'スコップを使うときは、周りに人がいないか確認してね' },
  'knife': { risk: '刃物を使用', message: '包丁は優しく扱ってね。指を切らないように気をつけよう' },
  'scissors': { risk: 'はさみを使用', message: 'はさみは走り回らずに、座って使おうね' },
  'tool': { risk: '道具を使用', message: '道具は正しく使おうね。困ったら声をかけてね' },
  'ladder': { risk: 'はしごの使用', message: 'はしごは不安定だから、誰かに支えてもらおうね' },
  
  // 姿勢・動作関連
  'falling': { risk: '転倒の危険', message: 'ゆっくり歩こうね。急いで転んじゃうと痛いよ' },
  'lying': { risk: '体調不良の可能性', message: '具合が悪そうだね。少し休んでみない？' },
  'sitting': { risk: '不安定な姿勢', message: '座り方が危なそうだよ。もう少し安定した場所に座ろうか' },
  'bending': { risk: '腰への負担', message: '前かがみが続いているね。たまには背筋を伸ばして休もう' },
  'reaching': { risk: '無理な姿勢', message: '背伸びして取ろうとしてるね。踏み台を使った方が安全だよ' },
  
  // 場所関連
  'stairs': { risk: '階段での転倒危険', message: '階段は手すりを持って、ゆっくり上り下りしようね' },
  'kitchen': { risk: '調理場での事故', message: 'お料理楽しいね。火や包丁に気をつけてね' },
  'bathroom': { risk: '滑りやすい場所', message: 'お風呂場は滑りやすいから、ゆっくり歩こうね' },
  
  // 状況関連
  'alone': { risk: '一人での作業', message: '難しそうな作業は、誰かと一緒にやった方が安全だよ' },
  'dark': { risk: '暗所での作業', message: '暗いところでの作業は危ないよ。明るくしてからやろうね' },
  'wet': { risk: '濡れた場所', message: '床が濡れてるね。滑らないようにゆっくり歩こう' }
};

// ヘルパー関数
function generateActivityDescription(allDetections: string[], detectedSituations: Set<string>): string {
  const activities = Array.from(detectedSituations)
    .map(situation => DANGEROUS_SITUATIONS[situation].risk)
    .filter(Boolean);

  if (activities.length === 0) {
    return '特に危険な作業は検出されませんでした。';
  }

  return `現在、${activities.join('、')}をしているようです。`;
}

function generateEnvironmentDescription(allDetections: string[], safeSearch: any): string {
  const environmentFactors = [];

  // 明るさの検出
  if (allDetections.includes('dark') || allDetections.includes('night')) {
    environmentFactors.push('暗い場所');
  }

  // 天気の検出
  if (allDetections.includes('rain') || allDetections.includes('wet')) {
    environmentFactors.push('濡れた場所');
  }

  // 場所の特定
  if (allDetections.includes('kitchen')) {
    environmentFactors.push('台所');
  } else if (allDetections.includes('bathroom')) {
    environmentFactors.push('浴室');
  } else if (allDetections.includes('garden')) {
    environmentFactors.push('庭');
  }

  if (environmentFactors.length === 0) {
    return '周囲の環境は特に危険な要素は見当たりません。';
  }

  return `周囲の環境は${environmentFactors.join('、')}です。`;
}

function generateWarningMessage(detectedSituations: string[]): string {
  if (detectedSituations.length === 0) {
    return 'お気をつけて作業を続けてくださいね。';
  }

  const messages = detectedSituations
    .map(situation => DANGEROUS_SITUATIONS[situation].message)
    .filter(Boolean);

  return messages.join('\n');
}

// 主要な分析関数
async function analyzeContent(
  objects: string[],
  labels: string[],
  safeSearch: any
): Promise<AnalysisResult> {
  const allDetections = [...objects, ...labels].map(item => item.toLowerCase());
  const risks: string[] = [];
  const detectedSituations = new Set<string>();

  // 検出されたオブジェクトから作業内容を推測
  for (const detection of allDetections) {
    if (DANGEROUS_SITUATIONS[detection]) {
      detectedSituations.add(detection);
      risks.push(DANGEROUS_SITUATIONS[detection].risk);
    }
  }

  // 特定の組み合わせの検出（一人での作業）
  const isAlone = allDetections.includes('person') && 
    objects.filter(obj => obj.toLowerCase() === 'person').length === 1;
  if (isAlone) {
    detectedSituations.add('alone');
  }

  return {
    activity: generateActivityDescription(allDetections, detectedSituations),
    environment: generateEnvironmentDescription(allDetections, safeSearch),
    risks,
    warningMessage: generateWarningMessage(Array.from(detectedSituations))
  };
}

// エクスポートする関数
export async function analyzeImage(imageData: ArrayBuffer): Promise<AnalysisResult> {
  try {
    const [result] = await visionClient.annotateImage({
      image: { content: Buffer.from(imageData) },
      features: [
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'LABEL_DETECTION' },
        { type: 'SAFE_SEARCH_DETECTION' }
      ]
    });

    const objects = result.localizedObjectAnnotations?.map(obj => obj.name) || [];
    const labels = result.labelAnnotations?.map(label => label.description) || [];
    const safeSearch = result.safeSearchAnnotation;

    return await analyzeContent(objects, labels, safeSearch);
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}

export async function generateWarningAudio(analysis: AnalysisResult): Promise<ArrayBuffer> {
  const textToSpeak = `${analysis.activity}\n${analysis.environment}\n${analysis.warningMessage}`;
  return await elevenLabs.generateSpeech(textToSpeak);
}
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

export async function async analyzeImage(imageData: ArrayBuffer): Promise<AnalysisResult> {
  try {
    // Google Cloud Vision APIで画像を分析
    const [result] = await visionClient.annotateImage({
      image: { content: Buffer.from(imageData) },
      features: [
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'LABEL_DETECTION' },
        { type: 'SAFE_SEARCH_DETECTION' }
      ]
    });

    const objects = result.localizedObjectAnnotations?.map(obj => obj.name) || [];
    const labels = result.labelAnnotations?.map(label => label.description) || [];
    const safeSearch = result.safeSearchAnnotation;

    // 詳細な分析を実行
    return await analyzeContent(objects, labels, safeSearch);
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
} {
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

export async function async generateWarningAudio(analysis: AnalysisResult): Promise<ArrayBuffer> {
  // 音声化するテキストを生成
  const textToSpeak = `${analysis.activity}\n${analysis.environment}\n${analysis.warningMessage}`;
  
  // ElevenLabsを使用して音声を生成
  return await elevenLabs.generateSpeech(textToSpeak);
} {
  const warningMessage = `注意！${situation}が検出されました。すぐに確認してください。`;
  return await elevenLabs.generateSpeech(warningMessage);
}
