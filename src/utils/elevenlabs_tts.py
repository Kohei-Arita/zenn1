import requests
import os
from typing import Dict, Optional

class ElevenLabsClient:
    """ElevenLabs APIクライアント"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ELEVENLABS_API_KEY')
        if not self.api_key:
            raise ValueError("ElevenLabs API key is required")
        
        self.base_url = "https://api.elevenlabs.io/v1"
        self.headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        
        # デフォルトの音声設定
        self.voice_settings = {
            "stability": 0.5,
            "similarity_boost": 0.8,
            "style": 0.3
        }
    
    def generate_speech(self, text: str, voice_id: str = "iP95p4xoKVk53GoZ742B") -> bytes:
        """
        テキストを音声に変換
        
        Args:
            text: 音声化するテキスト
            voice_id: 使用する音声のID（デフォルトは「Rachel」）
        
        Returns:
            音声データ（バイナリ）
        """
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        data = {
            "model_id": "eleven_multilingual_v2",
            "text": text,
            "voice_settings": self.voice_settings
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code == 200:
            return response.content
        else:
            raise Exception(f"Error generating speech: {response.status_code} - {response.text}")

if __name__ == '__main__':
    # テスト用コード
    client = ElevenLabsClient()
    try:
        audio_content = client.generate_speech("こんにちは、テストです。")
        # テスト用の音声ファイルを保存
        with open("test_output.mp3", "wb") as audio_file:
            audio_file.write(audio_content)
        print("Test audio file generated: test_output.mp3")
    except Exception as e:
        print(f"Error: {e}")
