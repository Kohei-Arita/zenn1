import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// テストデータ
const testData = {
  environment: "作業場所: 工場内製造ライン\n天候: 屋内\n広さ: 約50平方メートルの作業スペース",
  safety: "潜在危険: 重機との接触の可能性\n理由: 作業エリア内での重機の移動が頻繁",
  informative_message: "重機の移動に注意してください！",
  timestamp: new Date().toISOString()
};

export async function GET() {
  try {
    console.log('テストデータの書き込みを開始...');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    
    // データを書き込み
    await set(ref(database, 'analysis'), testData);
    
    console.log('テストデータを書き込みました:', testData);
    
    return NextResponse.json({ success: true, data: testData });
  } catch (error) {
    console.error('テストデータの書き込みエラー:', error);
    return NextResponse.json(
      { error: 'Failed to write test data' },
      { status: 500 }
    );
  }
}
