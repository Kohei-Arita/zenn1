import Image from "next/image";
import { ImageUploader } from "@/components/ImageUploader";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">高齢者見守りサービス</h1>
          <p className="text-lg text-gray-600">
            画像をアップロードして、高齢者の安全を確認します
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <ImageUploader />
        </div>

        <div className="mt-8 max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">このサービスについて</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>AIが画像を分析して危険な状況を検出します</li>
            <li>危険が検出された場合、音声で警告を発します</li>
            <li>24時間365日、安全な生活をサポートします</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
