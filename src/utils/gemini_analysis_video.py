import os
import json
import logging
import tempfile
from pathlib import Path

# プロジェクトルートの.env.localを読み込む（必要に応じて調整）
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent.parent / '.env.local'
load_dotenv(env_path)

import base64
from typing import Optional

import vertexai
from vertexai.generative_models import GenerativeModel, Part
from google.cloud import storage

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === GeminiAnalyzer クラス（動画解析版） ===
class GeminiAnalyzer:
    """
    Gemini を使用して動画解析を行うクラス
    （※元コードは画像用ですが、ここでは MIME タイプやプロンプトを調整して動画を対象としています）
    """
    
    def __init__(self, project_id: Optional[str] = None, location: str = "us-central1"):
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        if not self.project_id:
            raise ValueError(
                "Project ID is required. Please provide it via the constructor or set GOOGLE_CLOUD_PROJECT."
            )
        self.location = location
        # Vertex AI の初期化
        vertexai.init(project=self.project_id, location=self.location)
        # ※ここではGemini 1.5 Flash-002（安定版例）を使用していますが、必要に応じて変更してください
        self.model = GenerativeModel("gemini-1.5-flash-002")
    
    def _analyze_with_prompt(self, video_data: bytes, prompt: str) -> str:
        """指定されたプロンプトで動画解析を実行（動画の MIME は "video/mp4" とする）"""
        response = self.model.generate_content(
            [
                prompt,
                Part.from_data(video_data, mime_type='video/mp4')
            ]
        )
        return response.text.strip()
    
    def analyze_video(self, video_data: bytes) -> str:
        """
        動画を解析し、作業内容、危険性、メッセージを抽出して JSON 文字列で返す
        
        Args:
            video_data: 解析対象動画のバイナリデータ（動画に音声は含まれていない）
        
        Returns:
            JSON 形式の文字列（キー: "作業内容", "危険性", "メッセージ"）
        """
        import json

        # ① 作業内容の抽出
        work_prompt = (
            "あなたは、映像から作業内容を抽出するエージェントです。\n"
            "与えられた動画から、実施されている具体的な作業や活動内容を簡潔かつ明確に記述してください。\n"
            "【出力形式】\n作業内容： ・・・"
        )
        work_content = self._analyze_with_prompt(video_data, work_prompt)
        
        # ② 危険性の抽出
        danger_prompt = (
            "あなたは、映像から潜在する危険性を抽出するエージェントです。\n"
            "与えられた動画から、作業環境に潜む具体的な危険要因やリスクを簡潔かつ明確に記述してください。\n"
            "【出力形式】\n危険性： ・・・"
        )
        danger_content = self._analyze_with_prompt(video_data, danger_prompt)
        
        # ③ メッセージの抽出
        message_prompt = (
            "あなたは、映像から伝えたいメッセージを抽出するエージェントです。\n"
            "与えられた動画から、映像が伝えようとしている主なメッセージを一言で表現してください。\n"
            "【出力形式】\nメッセージ： ・・・"
        )
        message_content = self._analyze_with_prompt(video_data, message_prompt)
        
        result = {
            "作業内容": work_content,
            "危険性": danger_content,
            "メッセージ": message_content
        }
        return json.dumps(result, ensure_ascii=False, indent=2)

# === Cloud Function ハンドラー ===
def analyze_video_to_json(event, context):
    """
    Cloud Storage にアップロードされた動画ファイル(mp4)をトリガーとして実行されます。
    動画ファイルから Gemini API を使い、作業内容・危険性・メッセージの３項目を抽出し、
    結果を JSON ファイルとして同じバケットに保存します。
    """
    try:
        bucket_name = event["bucket"]
        file_name = event["name"]
    except KeyError:
        logger.error("イベントデータに 'bucket' または 'name' が含まれていません。")
        return

    logger.info(f"対象ファイル: {file_name} (bucket: {bucket_name})")
    
    if not file_name.lower().endswith('.mp4'):
        logger.info("対象ファイルは mp4 ではないため、処理をスキップします。")
        return

    # GCS から動画ファイルを /tmp にダウンロード
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)
    temp_dir = tempfile.gettempdir()
    local_video_path = os.path.join(temp_dir, os.path.basename(file_name))
    try:
        blob.download_to_filename(local_video_path)
        logger.info(f"動画ファイルを {local_video_path} にダウンロードしました。")
    except Exception as e:
        logger.error(f"動画ファイルのダウンロードに失敗しました: {e}")
        return

    # 動画ファイルをバイナリデータとして読み込む
    try:
        with open(local_video_path, "rb") as f:
            video_data = f.read()
    except Exception as e:
        logger.error(f"動画ファイルの読み込みに失敗しました: {e}")
        return

    # GeminiAnalyzer を使って動画解析（動画に音声はない前提）
    try:
        analyzer = GeminiAnalyzer()
        analysis_result_json = analyzer.analyze_video(video_data)
        logger.info(f"解析結果: {analysis_result_json}")
    except Exception as e:
        logger.error(f"動画解析中にエラーが発生しました: {e}")
        return

    # 結果ファイル名（元のファイル名の拡張子を .json に変更）
    output_file_name = file_name.rsplit('.', 1)[0] + ".json"
    output_blob = bucket.blob(output_file_name)
    try:
        output_blob.upload_from_string(
            analysis_result_json,
            content_type="application/json"
        )
        logger.info(f"JSON 結果ファイルをアップロードしました: {output_file_name}")
    except Exception as e:
        logger.error(f"JSON 結果ファイルのアップロードに失敗しました: {e}")
        return
