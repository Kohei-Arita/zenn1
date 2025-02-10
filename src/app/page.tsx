"use client";

import { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, Database } from 'firebase/database';
import ReactMarkdown from 'react-markdown';

interface AnalysisData {
  environment: string;
  safety: string;
  informative_message: string;
}

// Firebaseの設定
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

// Firebaseの初期化
// console.log('🔥 Firebase設定:', firebaseConfig);

let database: Database;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  console.log('✅ Firebase Appの初期化成功');
  
  database = getDatabase(app);
  console.log('✅ Realtime Databaseの初期化成功');
} catch (error) {
  console.error('❌ Firebaseの初期化エラー:', error);
}

export default function Home() {
  console.log('🟢 Homeコンポーネントがレンダリングされました');
  
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Firebaseの接続状態を監視
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!database) {
      console.error('❌ databaseが初期化されていません');
      return;
    }

    try {
      const connectedRef = ref(database, '.info/connected');
      console.log('🔗 接続監視を開始:', connectedRef.toString());

      unsubscribe = onValue(connectedRef, 
        (snap) => {
          const connected = snap.val() === true;
          console.log(`接続状態: ${connected ? '✅ 接続中' : '❌ 未接続'}`);
          setIsConnected(connected);
        },
        (error) => {
          console.error('❌ 接続監視エラー:', error);
          setIsConnected(false);
        }
      );
    } catch (error) {
      console.error('❌ 接続監視の設定エラー:', error);
      setIsConnected(false);
    }

    return () => {
      if (unsubscribe) {
        console.log('🔔 接続監視を終了します');
        unsubscribe();
      }
    };
  }, [database]); // databaseを依存配列に追加

  // データの監視
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!database) {
      console.log('🔔 データ監視: databaseが初期化されていません');
      return;
    }

    if (!isConnected) {
      console.log('🔔 データ監視: 接続待機中...');
      return;
    }

    console.log('📝 分析データの監視を開始...');
    const geminiOutputsRef = ref(database, 'gemini_outputs');
    console.log('監視パス:', geminiOutputsRef.toString());

    try {
      unsubscribe = onValue(geminiOutputsRef, (snapshot) => {
        console.log('📥 データ更新を検出しました');
        const data = snapshot.val();
        console.log('受信したデータ:', data);

        if (data) {
          // 最新のデータを取得
          const motionFolders = Object.keys(data);
          if (motionFolders.length > 0) {
            const latestMotion = motionFolders[motionFolders.length - 1];
            const motionData = data[latestMotion];

            if (motionData) {
              console.log('✅ 新しい分析データ:', {
                timestamp: new Date().toISOString(),
                folder: latestMotion,
                environment: motionData["environment"],
                safety: motionData["safety"],
                informative_message: motionData["informative_message"]
              });

              setAnalysisData({
                environment: motionData["environment"],
                safety: motionData["safety"],
                informative_message: motionData["informative_message"]
              });
              
              if (motionData.audio_url) {
                console.log('🔊 音声URL:', motionData.audio_url);
                setAudioUrl(motionData.audio_url);
                const audio = new Audio(motionData.audio_url);
                audio.play().catch(error => {
                  console.error('❌ 音声再生エラー:', error);
                });
              }
            } else {
              console.log('⚠️ JSONデータが見つかりません:', latestMotion);
            }
          } else {
            console.log('⚠️ motionフォルダが見つかりません');
          }
        } else {
          console.log('⚠️ データが空または存在しません');
        }
      }, (error) => {
        console.error('❌ データ監視エラー:', error);
      });

      return () => {
        console.log('🔔 データ監視を終了します');
        unsubscribe();
      };
    } catch (error) {
      console.error('❌ データ監視の設定エラー:', error);
      return () => {};
    }

  }, [database, isConnected]); // databaseとisConnectedを依存配列に追加

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* カメラフィード */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">リアルタイム監視</h2>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <img
                src={process.env.NEXT_PUBLIC_IP_CAMERA_URL}
                alt="Camera Feed"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          {/* 分析情報 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">分析情報</h2>
            {analysisData ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">作業環境</h3>
                  <div className="prose prose-sm max-w-none text-gray-600 prose-headings:text-blue-600 prose-h2:font-semibold prose-h3:font-semibold">
                    <ReactMarkdown>{analysisData.environment}</ReactMarkdown>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">安全性</h3>
                  <div className="prose prose-sm max-w-none text-gray-600 prose-headings:text-blue-600 prose-h2:font-semibold prose-h3:font-semibold">
                    <ReactMarkdown>{analysisData.safety}</ReactMarkdown>
                  </div>
                </div>
                {analysisData.informative_message && (
                  <div className="bg-red-100 border-l-4 border-red-500 p-4">
                    <p className="text-red-700">{analysisData.informative_message}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">分析データを待っています...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
