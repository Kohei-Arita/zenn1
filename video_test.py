import cv2
import time
import os
from datetime import datetime
from google.cloud import storage
from pathlib import Path

class MotionDetector:
    def __init__(self, url, buffer_seconds=5, motion_threshold=1000, min_area=500):
        self.url = url
        self.capture = cv2.VideoCapture(url)
        self.buffer_seconds = buffer_seconds
        self.motion_threshold = motion_threshold
        self.min_area = min_area
        
        # 動画保存用の設定
        self.frame_width = int(self.capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.frame_height = int(self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.fps = int(self.capture.get(cv2.CAP_PROP_FPS))
        self.fourcc = cv2.VideoWriter_fourcc(*'avc1')
        
        # 動体検知用の設定
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=16, detectShadows=False)
        
        # フレームバッファ
        self.frame_buffer = []
        self.is_recording = False
        self.motion_detected = False
        self.last_motion_time = None
        
        # GCS設定
        self.storage_client = storage.Client()
        self.bucket_name = 'my_video_bucket-1'  # GCSバケット名を設定してください
        
        # 出力ディレクトリの作成
        self.output_dir = Path('motion_clips')
        self.output_dir.mkdir(exist_ok=True)

    def upload_to_gcs(self, local_path):
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blob_name = f'motion_clips/{os.path.basename(local_path)}'
            blob = bucket.blob(blob_name)
            blob.upload_from_filename(local_path)
            print(f'Successfully uploaded {local_path} to GCS')
            return True
        except Exception as e:
            print(f'Error uploading to GCS: {e}')
            return False

    def save_buffer(self):
        if not self.frame_buffer:
            return

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = str(self.output_dir / f'motion_{timestamp}.mp4')
        
        try:
            out = cv2.VideoWriter(
                output_path, self.fourcc, self.fps,
                (self.frame_width, self.frame_height)
            )
            
            if not out.isOpened():
                print(f'Error: VideoWriterを開けませんでした: {output_path}')
                return
            
            for frame in self.frame_buffer:
                if frame is not None:
                    out.write(frame)
            
            out.release()
            
            # 保存された動画ファイルが正しく作成されたか確認
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f'動画クリップを保存しました: {output_path}')
            else:
                print(f'Error: 動画ファイルの保存に失敗した可能性があります: {output_path}')
        except Exception as e:
            print(f'動画保存中にエラーが発生しました: {e}')
            if 'out' in locals():
                out.release()
        print(f'Saved video clip: {output_path}')
        
        # GCSにアップロード
        self.upload_to_gcs(output_path)

    def detect_motion(self, frame):
        # 背景差分を取得
        fg_mask = self.bg_subtractor.apply(frame)
        
        # ノイズ除去
        fg_mask = cv2.erode(fg_mask, None, iterations=2)
        fg_mask = cv2.dilate(fg_mask, None, iterations=2)
        
        # 輪郭を検出
        contours, _ = cv2.findContours(
            fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        motion_detected = False
        for contour in contours:
            if cv2.contourArea(contour) > self.min_area:
                motion_detected = True
                break
        
        return motion_detected

    def run(self):
        if not self.capture.isOpened():
            print(f'Error: カメラストリームを開けませんでした。URL: {self.url}')
            return

        print('ストリーム接続成功。動体検知を開始します...')

        while True:
            ret, frame = self.capture.read()
            
            if not ret:
                print('フレームの取得に失敗しました。再試行します...')
                time.sleep(1)
                continue

            # 動体検知
            current_motion = self.detect_motion(frame)
            
            # フレームバッファの管理
            self.frame_buffer.append(frame)
            if len(self.frame_buffer) > self.fps * self.buffer_seconds:
                self.frame_buffer.pop(0)
            
            # 動体検知状態の管理
            if current_motion:
                self.last_motion_time = time.time()
                if not self.motion_detected:
                    print('動体を検知しました')
                    self.motion_detected = True
            elif self.motion_detected:
                if time.time() - self.last_motion_time > self.buffer_seconds:
                    print('動体検知が終了しました')
                    self.save_buffer()
                    self.motion_detected = False
                    self.frame_buffer.clear()
            
            # 動体検知範囲を表示（デバッグ用）
            cv2.putText(frame, 
                       f'Motion: {"Detected" if current_motion else "None"}',
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            try:
                cv2.imshow('Motion Detection', frame)
            except cv2.error as e:
                print(f'表示エラー: {e}')
                break
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        self.capture.release()
        cv2.destroyAllWindows()

# メイン処理
if __name__ == '__main__':
    url = 'http://192.168.0.90:8080/video.mjpg'  # URLは実際のストリームURLに合わせて変更してください
    detector = MotionDetector(url)
    detector.run()

capture.release()
cv2.destroyAllWindows()
