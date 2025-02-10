import os
import json
import logging
import tempfile
from pathlib import Path
from typing import Optional

import base64
import vertexai
from vertexai.generative_models import GenerativeModel, Part

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === GeminiAnalyzer クラス（動画解析版） ===
class GeminiAnalyzer:
    """
    Gemini を使用して動画解析を行うクラス
    """
    
    def __init__(self, project_id: Optional[str] = "ai-agent-449514", location: str = "asia-northeast1"):
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        if not self.project_id:
            raise ValueError(
                "Project ID is required. Please provide it via the constructor or set GOOGLE_CLOUD_PROJECT."
            )
        self.location = location
        # Vertex AI の初期化
        vertexai.init(project=self.project_id, location=self.location)
        # ※Gemini 1.5 Flash-002（安定版例）を使用しています。必要に応じて変更してください。
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
        # ① 作業内容の抽出
        work_prompt = """
        あなたは、映像から作業内容およびその周辺環境を抽出することに特化したエージェントです。
        与えられた映像に基づき、写っている活動や作業、そしてその環境について以下の各項目に沿って、簡潔かつ明確に説明してください。

        【出力形式】

        作業内容： 映像内で実施されている具体的な作業や活動を記述してください。
        場所： 映像から推測される場所や環境（屋内、屋外、特定の施設など）を記述してください。
        天候： 屋外の場合、映像から読み取れる天候（例：晴れ、曇り、雨など）を記述してください。

        """
        work_content = self._analyze_with_prompt(video_data, work_prompt)
        
        # ② 危険性の抽出
        danger_prompt = f"""
        あなたは、映像から抽出された作業内容や環境情報に基づき、作業中に潜在する危険性を評価・抽出することに特化したエージェントです。
        以下の「作業内容・環境」情報（{work_content}）に基づいて、この状況下で作業を行う場合に考えられる具体的な危険を、以下の項目に沿って，簡潔かつ明確に説明してください。

        【出力形式】

        潜在危険： 映像の作業内容や環境から推測される、具体的な危険要因やリスク（例：転倒、機械的事故、感電、滑りやすい床、悪天候による視界不良など）を記述してください。
        理由： それぞれの危険が発生する可能性の背景や理由を、簡潔に説明してください。

        """
        danger_content = self._analyze_with_prompt(video_data, danger_prompt)
        
        # ③ メッセージの抽出
        message_prompt = f"""
        あなたは、抽出された危険性情報に基づき、優しい口調でこの状況下で気をつけるべきことを一言で提案するエージェントです。
        以下の「危険性」情報（{danger_content}）を踏まえて、シンプルかつ親しみやすい一言で安全対策を提案してください。
        """
        message_content = self._analyze_with_prompt(video_data, message_prompt)
        
        result = {
            "environment": work_content,
            "safety": danger_content,
            "informative_message": message_content
        }
        return json.dumps(result, ensure_ascii=False, indent=2)

# === Cloud Function ハンドラー ===
def analyze_video_to_json(event, context):
    """
    Cloud Storage にアップロードされた動画ファイル(mp4)をトリガーとして実行されます。
    動画ファイルから Gemini API を使い、作業内容・危険性・メッセージの３項目を抽出し、
    結果を JSON 形式で Firebase Realtime Database に保存します。
    """
    try:
        bucket_name = event['bucket']
        file_name = event['name']
    except KeyError:
        logger.error("イベントデータに 'bucket' または 'name' が含まれていません。")
        return

    logger.info(f"対象ファイル: {file_name} (bucket: {bucket_name})")
    
    if not file_name.lower().endswith('.mp4'):
        logger.info("対象ファイルは mp4 ではないため、処理をスキップします。")
        return

    # GCS から動画ファイルを /tmp にダウンロード
    from google.cloud import storage
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

    # GeminiAnalyzer を使って動画解析
    try:
        analyzer = GeminiAnalyzer()
        analysis_result_json = analyzer.analyze_video(video_data)
        logger.info(f"解析結果: {analysis_result_json}")
    except Exception as e:
        logger.error(f"動画解析中にエラーが発生しました: {e}")
        return

    # Firebase Admin SDK を利用して、解析結果を Realtime Database に保存する
    try:
        import firebase_admin
        from firebase_admin import credentials, db
        # 初期化済みか確認。未初期化の場合は初期化
        if not firebase_admin._apps:
            # GCP環境の場合は Application Default Credentials を使用できます。
            # 自前のサービスアカウントキーを使う場合は credentials.Certificate("path/to/serviceAccountKey.json") としてください。
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'databaseURL': 'https://ai-agent-449514-default-rtdb.firebaseio.com/'
            })
    except Exception as e:
        logger.error(f"Firebase Admin SDK の初期化に失敗しました: {e}")
        return

    try:
        # JSON文字列を辞書型に変換
        result_data = json.loads(analysis_result_json)
        key = os.path.splitext(os.path.basename(file_name))[0]
        # Realtime Database の "gemini_outputs" ノード配下に書き込む
        ref = db.reference('gemini_outputs')
        ref.child(key).set(result_data)
        logger.info(f"Realtime Database に結果を保存しました: {key}")
    except Exception as e:
        logger.error(f"Realtime Database への保存に失敗しました: {e}")
        return
