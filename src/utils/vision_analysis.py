from google.cloud import vision
import json
import os
from typing import Dict, List

def analyze_image(image_content: bytes) -> Dict:
    """
    Google Cloud Vision APIを使用して画像を分析
    """
    client = vision.ImageAnnotatorClient()
    
    image = vision.Image(content=image_content)
    
    # 画像分析の実行
    response = client.annotate_image({
        'image': image,
        'features': [
            {'type_': vision.Feature.Type.OBJECT_LOCALIZATION},
            {'type_': vision.Feature.Type.LABEL_DETECTION},
            {'type_': vision.Feature.Type.SAFE_SEARCH_DETECTION},
        ]
    })
    
    # 検出されたオブジェクトと確信度を取得
    objects = [
        obj.name.lower()
        for obj in response.localized_object_annotations
    ]
    
    # ラベル検出結果を取得
    labels = [
        label.description.lower()
        for label in response.label_annotations
    ]
    
    # 結果を辞書形式で返す
    return {
        'objects': objects,
        'labels': labels,
        'safe_search': {
            'violence': str(response.safe_search_annotation.violence),
            'medical': str(response.safe_search_annotation.medical)
        }
    }

if __name__ == '__main__':
    # テスト用コード
    with open('test_image.jpg', 'rb') as image_file:
        content = image_file.read()
        result = analyze_image(content)
        print(json.dumps(result, indent=2, ensure_ascii=False))
