"use client";

import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface AnalysisData {
  environment: string;
  safety: string;
  informative_message: string;
}

export default function Home() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');

  useEffect(() => {
    // Firebase Realtime Databaseの監視
    const analysisRef = ref(database, 'analysis');
    const unsubscribe = onValue(analysisRef, (snapshot) => {
      const data = snapshot.val();
      console.log(data);
      if (data) {
        setAnalysisData(data);
        // 新しい音声が生成されたら再生
        if (data.audio_url) {
          setAudioUrl(data.audio_url);
          const audio = new Audio(data.audio_url);
          audio.play();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* カメラフィード */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">リアルタイム監視</h2>
            <div className="aspect-video relative bg-black rounded-lg overflow-hidden">
              <img
                src="http://192.168.1.38:8080/video.mjpg"
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
                  <p className="text-gray-600">{analysisData.environment}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">安全性</h3>
                  <p className="text-gray-600">{analysisData.safety}</p>
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
