export class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  // 若々しい日本語音声のID
  private voiceId = '21m00Tcm4TlvDq8ikWAM'; // 日本語女性音声

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateSpeech(text: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/text-to-speech/${this.voiceId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.71,
          similarity_boost: 0.85,
          style: 0.65,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate speech');
    }

    return await response.arrayBuffer();
  }
}
