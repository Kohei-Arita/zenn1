import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

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

let app: FirebaseApp;
let database: Database;

try {
  // Firebase Appの初期化
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Realtime Databaseの初期化
  database = getDatabase(app);
  
  if (!database) {
    throw new Error('Failed to initialize Realtime Database');
  }
  
  console.log('✅ Firebase初期化成功');
} catch (error) {
  console.error('❌ Firebase初期化エラー:', error);
  throw error; // 初期化に失敗した場合はアプリケーションを停止
}

export { app, database };
