from flask import Flask, render_template, Response
import cv2
from video_test import MotionDetector
import firebase_admin
from firebase_admin import db
import json
import requests
import os
from dotenv import load_dotenv

# .env.localファイルの読み込み
load_dotenv('.env.local')

app = Flask(__name__)

# Firebase初期化
cred = firebase_admin.credentials.Certificate('ai-agent-449514-firebase-adminsdk-fbsvc-68c67f32f2.json')
firebase_admin.initialize_app(cred)

# IPカメラのURL
CAMERA_URL = 'http://192.168.0.90:8080/video.mjpg'

# Eleven Labs API設定
ELEVEN_LABS_API_KEY = os.getenv('ELEVEN_LABS_API_KEY')
VOICE_ID = "iP95p4xoKVk53GoZ742B"  # Eleven Labsで選択した音声のID

def generate_frames():
    detector = MotionDetector(CAMERA_URL)
    while True:
        success, frame = detector.capture.read()
        if not success:
            break
        else:
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

def text_to_speech(text):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY
    }
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        with open("static/output.mp3", "wb") as f:
            f.write(response.content)
        return True
    return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(debug=True)
