import { NextResponse } from 'next/server';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = getDatabase(app);
    
    // Firebaseにデータを保存
    await set(ref(db, 'analysis'), {
      environment: data.environment,
      safety: data.safety,
      informative_message: data.informative_message,
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving analysis data:', error);
    return NextResponse.json({ error: 'Failed to save analysis data' }, { status: 500 });
  }
}
