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
    
    def analyze_image(self, image_data: bytes) -> str:
        """
        画像を分析し、作業内容、環境、注意点を抽出
        
        Args:
            image_data: 分析する画像のバイナリデータ
            
        Returns:
            JSON形式の分析結果
        """
        import json

        # 作業内容・環境の分析
        environment_prompt = """
        あなたは、画像から作業内容およびその周辺環境を抽出することに特化したエージェントです。
        与えられた画像に基づき、写っている活動や作業、そしてその環境について以下の各項目に沿って、簡潔かつ明確に説明してください。

        【出力形式】

        作業内容： 画像内で実施されている具体的な作業や活動を記述してください。
        場所： 画像から推測される場所や環境（屋内、屋外、特定の施設など）を記述してください。
        広さ： 画像に映っている空間の広がりや、狭さについて記述してください。
        天候： 屋外の場合、画像から読み取れる天候（例：晴れ、曇り、雨など）を記述してください。

        """
        environment = self._analyze_with_prompt(image_data, environment_prompt)
        
        # 危険性の分析
        safety_prompt = f"""
        あなたは、画像から抽出された作業内容や環境情報に基づき、作業中に潜在する危険性を評価・抽出することに特化したエージェントです。
        以下の「作業内容・環境」情報（{environment}）に基づいて、この状況下で作業を行う場合に考えられる具体的な危険を、簡潔かつ明確に説明してください。

        【出力形式】

        潜在危険： 画像の作業内容や環境から推測される、具体的な危険要因やリスク（例：転倒、機械的事故、感電、滑りやすい床、悪天候による視界不良など）を記述してください。
        理由： それぞれの危険が発生する可能性の背景や理由を、簡潔に説明してください。

        """
        safety = self._analyze_with_prompt(image_data, safety_prompt)
        
        # 注意点の分析
        informative_prompt = f"""
あなたは、抽出された危険性情報に基づき、優しい口調でこの状況下で気をつけるべきことを一言で提案するエージェントです。
以下の「危険性」情報（{safety}）を踏まえて、シンプルかつ親しみやすい一言で安全対策を提案してください。
        """
        informative_message = self._analyze_with_prompt(image_data, informative_prompt)
        
        # 結果をJSON文字列として返す
        result = {
            "environment": environment.strip(),
            "safety": safety.strip(),
            "informative_message": informative_message.strip()
        }
        return json.dumps(result, ensure_ascii=False)

if __name__ == '__main__':
    import json
    import sys

    # テスト用コード
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    print(f"Using project ID: {project_id}", file=sys.stderr)
    
    analyzer = GeminiAnalyzer(
        project_id=project_id
    )
    
    # テスト画像の読み込みと分析
    with open(sys.argv[1], 'rb') as f:
        image_data = f.read()
        result = analyzer.analyze_image(image_data)
        
        # 結果をJSON文字列として出力
        print(json.dumps(result, ensure_ascii=False))
