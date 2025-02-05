'use client';

import { useState } from 'react';
import Image from 'next/image';

export const ImageUploader = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    environment: string;
    safety: string;
    audio: string;
  } | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setAnalysisResult(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Prepare for upload
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      console.log('Uploading image for analysis...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `Analysis failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Analysis result:', result);
      setAnalysisResult(result);

      // Create and play audio from base64 string
      if (result.audio) {
        console.log('Processing audio...');
        const audioBlob = new Blob(
          [Buffer.from(result.audio, 'base64')],
          { type: 'audio/mpeg' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('Audio playback completed');
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setError('音声の再生に失敗しました');
        };

        console.log('Starting audio playback...');
        try {
          await audio.play();
          console.log('Audio playback started successfully');
        } catch (playError) {
          console.error('Failed to play audio:', playError);
          setError('音声の再生に失敗しました');
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-lg p-6">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
            </svg>
            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">クリックして画像をアップロード</span></p>
            <p className="text-xs text-gray-500">PNG, JPG (MAX. 10MB)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </label>
      </div>

      {error && (
        <div className="w-full max-w-xl bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {selectedImage && (
        <div className="relative w-full max-w-xl h-64">
          <Image
            src={selectedImage}
            alt="Uploaded preview"
            fill
            className="object-contain rounded-lg"
          />
        </div>
      )}

      {analysisResult && (
        <div className="w-full max-w-xl space-y-4">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">作業内容・環境</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{analysisResult.environment}</p>
          </div>

          <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-yellow-800">危険性</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{analysisResult.safety}</p>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">分析中...</span>
        </div>
      )}
    </div>
  );
};
