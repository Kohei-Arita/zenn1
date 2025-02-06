import functions_framework
from google.cloud import storage
import os
import sys
from pathlib import Path
import cv2
import numpy as np
import json
from flask import Flask, request

app = Flask(__name__)

# gemini_analysis.pyへのパスを追加
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent / 'src'
sys.path.append(str(src_dir))

from utils.gemini_analysis import GeminiAnalyzer

@app.route('/', methods=['POST'])
def analyze_video():
    """Cloud Storageのトリガーで実行される関数"""
    try:
        # Cloud Storageトリガーからのデータを取得
        request_json = request.get_json(silent=True)
        if not request_json:
            return {"error": "No JSON data received"}, 400

        data = request_json

        bucket_name = data["bucket"]
        file_name = data["name"]
        
        # motion_clipsディレクトリ内のファイルのみを処理
        if not file_name.startswith("motion_clips/"):
            print(f"Skipping file not in motion_clips directory: {file_name}")
            return ({"message": "Skipped non-motion_clips file"}, 200)
        
        # GCSクライアントの初期化
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        # 一時ファイルとして動画を保存
        temp_video_path = "/tmp/temp_video.mp4"
        blob.download_to_filename(temp_video_path)
        
        try:
            # 動画から最初のフレームを抽出
            cap = cv2.VideoCapture(temp_video_path)
            ret, frame = cap.read()
            if not ret:
                raise Exception("Failed to read video frame")
            
            # フレームをJPEG形式に変換
            _, buffer = cv2.imencode('.jpg', frame)
            image_data = buffer.tobytes()
            
            # Gemini分析の実行
            analyzer = GeminiAnalyzer()
            analysis_result = analyzer.analyze_image(image_data)
            
            # 分析結果をテキストファイルとして保存
            result_filename = f"{os.path.splitext(file_name)[0]}_analysis.txt"
            result_blob = bucket.blob(result_filename)
            result_blob.upload_from_string(analysis_result)
            
            print(f"Analysis completed for {file_name}")
            print(f"Results saved to {result_filename}")
            
            return ({"message": "Analysis completed successfully", "result_file": result_filename}, 200)
            
        finally:
            # 一時ファイルの削除
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
            
            # VideoCaptureのリリース
            if 'cap' in locals():
                cap.release()
                
    except Exception as e:
        print(f"Error in analyze_video: {str(e)}")
        return ({"error": str(e)}, 500)

if __name__ == "__main__":
    # PORT環境変数から取得（デフォルトは8080）
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
