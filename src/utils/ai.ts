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
  activity: string;      // 活動内容の説明
  environment: string;   // 周囲の環境説明
  informativeMessage: string; // 状況に応じた情報メッセージ
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
} as const;

// ヘルパー関数
function generateActivityDescription(allDetections: string[], detectedSituations: Set<string>): string {
  const activities = new Set<string>();

  // 一般的な活動の検出
  const commonActivities = {
    'cooking': '料理',
    'cleaning': '掃除',
    'reading': '読書',
    'writing': '筆記',
    'eating': '食事',
    'working': '仕事',
    'studying': '勉強',
    'exercising': '運動',
    'resting': '休息',
    'talking': '会話',
    'walking': '歩行'
  };

  for (const [key, value] of Object.entries(commonActivities)) {
    if (allDetections.includes(key)) {
      activities.add(value);
    }
  }

  if (activities.size === 0) {
    return '特に目立った活動は見られません。';
  }

  return `${Array.from(activities).join('、')}をされているようです。`;
}

function generateEnvironmentDescription(allDetections: string[], safeSearch: any): string {
  const environmentFactors = [];

  // 場所の検出
  const locations = {
    'kitchen': '台所',
    'bathroom': '浴室',
    'garden': '庭',
    'living room': 'リビング',
    'bedroom': '寝室',
    'office': 'オフィス',
    'outdoor': '外',
    'indoor': '室内'
  };

  for (const [key, value] of Object.entries(locations)) {
    if (allDetections.includes(key)) {
      environmentFactors.push(value);
    }
  }

  // 環境の状態
  const conditions = {
    'bright': '明るい',
    'dark': '暗め',
    'quiet': '静か',
    'noisy': '賑やか',
    'warm': '暖かい',
    'cold': '寒い'
  };

  for (const [key, value] of Object.entries(conditions)) {
    if (allDetections.includes(key)) {
      environmentFactors.push(value);
    }
  }

  if (environmentFactors.length === 0) {
    return '普通の室内環境のようです。';
  }

  return `${environmentFactors.join('、')}な環境です。`;
}

function generateInformativeMessage(allDetections: string[], detectedSituations: string[]): string {
  // 検出された物や状況に基づいて情報メッセージを生成
  const messages: string[] = [];
  
  // 人の存在を確認
  const personCount = allDetections.filter(item => item.toLowerCase() === 'person').length;
  if (personCount > 0) {
    messages.push(`${personCount}人の方がいらっしゃいますね。`);
  }

  // 作業や活動の種類を確認
  const activities = new Set(allDetections.filter(item => 
    ['working', 'cooking', 'cleaning', 'reading', 'writing', 'exercising'].includes(item.toLowerCase())
  ));
  if (activities.size > 0) {
    messages.push(`${Array.from(activities).join('、')}をされているようですね。`);
  }

  // 危険に関する注意事項があれば追加
  const safetyMessages = detectedSituations
    .map(situation => DANGEROUS_SITUATIONS[situation as keyof typeof DANGEROUS_SITUATIONS]?.message)
    .filter(Boolean);
  
  if (safetyMessages.length > 0) {
    messages.push(...safetyMessages);
  }

  // デフォルトメッセージ
  if (messages.length === 0) {
    return 'いつも通り順調そうですね。何かお手伝いが必要でしたら、お声がけください。';
  }

  return messages.join('\n');
}

// 主要な分析関数
async function analyzeContent(
  objects: string[],
  labels: string[],
  safeSearch: any
): Promise<AnalysisResult> {
  const allDetections = [...objects, ...labels].map(item => item.toLowerCase());
  const detectedSituations = new Set<string>();

  // 状況の検出
  for (const detection of allDetections) {
    if (DANGEROUS_SITUATIONS[detection as keyof typeof DANGEROUS_SITUATIONS]) {
      detectedSituations.add(detection);
    }
  }

  // 人の数を確認
  const personCount = objects.filter(obj => obj.toLowerCase() === 'person').length;
  if (personCount === 1) {
    detectedSituations.add('alone');
  }

  return {
    activity: generateActivityDescription(allDetections, detectedSituations),
    environment: generateEnvironmentDescription(allDetections, safeSearch),
    informativeMessage: generateInformativeMessage(allDetections, Array.from(detectedSituations))
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

export async function generateDescriptiveAudio(analysis: AnalysisResult): Promise<ArrayBuffer> {
  // より自然な会話のような形式でテキストを構成
  const textToSpeak = `${analysis.informativeMessage}\nそれから、${analysis.environment}\n${analysis.activity}`;
  return await elevenLabs.generateSpeech(textToSpeak);
}
