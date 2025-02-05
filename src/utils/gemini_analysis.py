import os
from pathlib import Path
from dotenv import load_dotenv

# プロジェクトルートの.env.localを読み込む
env_path = Path(__file__).resolve().parent.parent.parent / '.env.local'
load_dotenv(env_path)

import base64
from typing import Dict, Optional

import vertexai
from vertexai.generative_models import GenerativeModel, Part

class GeminiAnalyzer:
    """Geminiを使用して画像分析を行うクラス"""
    
    def __init__(self, project_id: Optional[str] = None, location: str = "us-central1"):
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        if not self.project_id:
            raise ValueError(
                "Project ID is required. Please provide it either through the constructor "
                "or by setting the GOOGLE_CLOUD_PROJECT environment variable."
            )
        
        self.location = location
        
        # Vertex AIの初期化
        vertexai.init(project=self.project_id, location=self.location)
        self.model = GenerativeModel("gemini-1.5-flash-002")
    
    def _analyze_with_prompt(self, image_data: bytes, prompt: str) -> str:
        """指定されたプロンプトで画像分析を実行"""
        response = self.model.generate_content(
            [
                prompt,
                Part.from_data(image_data, mime_type='image/jpeg')
            ]
        )
        
        return response.text
    
    def analyze_image(self, image_data: bytes) -> Dict[str, str]:
        """
        画像を分析し、作業内容、環境、注意点を抽出
        
        Args:
            image_data: 分析する画像のバイナリデータ
            
        Returns:
            分析結果を含む辞書
        """
        # 作業内容・環境の分析
        environment_prompt = """
        あなたは，画像から作業内容と環境を抽出することに特化したエージェントです．
        この画像に写っている活動や作業，周辺環境について説明してください。
        具体的に何をしているのか、場所の特徴、明るさ、広さ、天候などの環境要因を簡潔に説明してください。
        """
        environment = self._analyze_with_prompt(image_data, environment_prompt)
        
        # 危険性の分析
        safety_prompt = f"""
        あなたは，画像から危険性を抽出することに特化したエージェントです．
        この画像の作業内容・環境を踏まえて，この状況で作業を行う場合にどのような危険があるか簡潔に説明してください。
        作業内容・環境：{environment}
        """
        safety = self._analyze_with_prompt(image_data, safety_prompt)
        
        # 注意点の分析
        informative_prompt = f"""
        あなたは，危険性を抽出し，優しい口調で提案することに特化したエージェントです．
        危険性を踏まえて，この状況で気をつけるべきことを一言で提案してください。
        危険性：{safety}
        """
        informative_message = self._analyze_with_prompt(image_data, informative_prompt)
        
        return {
            "environment": environment,
            "safety": safety,
            "informative_message": informative_message
        }

if __name__ == '__main__':
    # テスト用コード
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    print(f"Using project ID: {project_id}")
    
    analyzer = GeminiAnalyzer(
        project_id=project_id
    )
    
    # テスト画像の読み込みと分析
    with open('test_image.png', 'rb') as f:
        image_data = f.read()
        result = analyzer.analyze_image(image_data)
        
        print("=== 分析結果 ===")
        print("【作業内容・環境】")
        print(result['environment'])
        print("\n【危険性】")
        print(result['safety'])
        print("\n【アドバイス】")
        print(result['informative_message'])
