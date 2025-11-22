# dags/ad_update_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from PIL import Image
from datetime import datetime, timedelta
import requests
import re
import os
import base64
import io
import cv2
import numpy as np

# ========================
# 환경 변수
# ========================
API_BASE = os.getenv("BACKEND_API_BASE", "http://localhost:8080")
IMAGE_API_BASE = os.getenv("IMAGE_API_BASE", "http://192.168.219.103:8010")
USER_EMAIL = os.getenv("BACKEND_USER_EMAIL", "qqww@naver.com")  # Airflow 환경변수로 세팅 필요
USER_PASSWORD = os.getenv("BACKEND_USER_PASSWORD", "1234")

# ========================
# 함수 정의
# ========================

def fetch_jwt_token(**context):
    """로그인 API를 호출해서 JWT 토큰 발급"""
    url = f"{API_BASE}/auth/login"
    payload = {"email": USER_EMAIL, "password": USER_PASSWORD}

    resp = requests.post(url, json=payload)
    resp.raise_for_status()

    token = resp.json().get("token")
    if not token:
        raise ValueError(" JWT 토큰 발급 실패")

    print(" JWT 토큰 발급 완료")
    context['ti'].xcom_push(key="jwt_token", value=token)


def fetch_active_ad_runs(**context):
    """백엔드에서 집행 중인 광고 목록 조회"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"}

    url = f"{API_BASE}/meta/ad-runs/active?hoursSinceModified=24"
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    ad_runs = resp.json()
    print(f" 활성 광고 개수: {len(ad_runs)}")
    print(f"DEBUG 응답 샘플: {ad_runs[:1]}")
    context['ti'].xcom_push(key='ad_runs', value=ad_runs)


def decode_base64_image(base64_str):
    """Base64 → bytes 변환"""
    cleaned = base64_str.strip().replace("\n", "").replace("\r", "")
    if len(cleaned) % 4 != 0:
        cleaned += "=" * (4 - len(cleaned) % 4)
    return base64.b64decode(cleaned)


def generate_ad_text(**context):
    """백엔드의 /api/generate 호출 → 새 광고 문구 생성"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"}

    ad_runs = context['ti'].xcom_pull(key='ad_runs', task_ids='fetch_ad_runs')
    updated_texts = {}

    for ad in ad_runs:
        payload = {
            "product": ad.get("product"),
            "target": ad.get("target"),
            "purpose": ad.get("purpose"),
            "keyword": ad.get("keyword"),
            "duration": ad.get("duration"),
        }

        url = f"{API_BASE}/api/generate"
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()

        ad_texts = resp.json().get("adTexts", [])
        if ad_texts:
            new_text = ad_texts[0]
            ad_id = str(ad["adRunId"])
            updated_texts[ad_id] = new_text
            print(f" 문구 생성 완료 (adRunId={ad_id}): {new_text}")
        else:
            print(f" 문구 생성 실패: adRunId={ad['adRunId']}")

    context['ti'].xcom_push(key='updated_texts', value=updated_texts)


def compose_image(**context):
    """문구 + 이미지 합성"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"}

    ad_runs = context['ti'].xcom_pull(key='ad_runs', task_ids='fetch_ad_runs')
    updated_texts = context['ti'].xcom_pull(key='updated_texts', task_ids='generate_texts')
    updated_images = {}

    def clean_base64(b64_str: str) -> str:
        b64_str = b64_str.strip().replace("'", "").replace('"', "")
        if b64_str.startswith("data:image"):
            b64_str = b64_str.split(",", 1)[1]
        b64_str = b64_str.replace("\n", "").replace("\r", "").replace(" ", "")
        cleaned = re.sub(r'[^A-Za-z0-9+/=_-]', '', b64_str)
        if len(cleaned) % 4 != 0:
            cleaned += "=" * (4 - len(cleaned) % 4)
        return cleaned

    for ad in ad_runs:
        ad_id = str(ad["adRunId"])
        new_text = updated_texts.get(ad_id)
        if not new_text:
            continue

        original_img_base64 = ad.get("originalImageBase64")
        if not original_img_base64:
            continue

        try:
            cleaned_b64 = clean_base64(original_img_base64)
            img_bytes = base64.b64decode(cleaned_b64)
        except Exception as e:
            print(f" Base64 디코딩 실패 (adRunId={ad_id}): {e}")
            continue

        # Pillow → OpenCV fallback
        image = None
        try:
            image = Image.open(io.BytesIO(img_bytes))
            image.verify()
            image = Image.open(io.BytesIO(img_bytes))
        except Exception as e:
            try:
                nparr = np.frombuffer(img_bytes, np.uint8)
                image_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if image_cv is None:
                    raise ValueError("OpenCV도 이미지 읽기 실패")
                image = Image.fromarray(cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB))
            except Exception as e2:
                print(f" 이미지 인식 실패 (adRunId={ad_id}): {e2}")
                continue

        # PNG 변환
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        img_bytes = buffer.getvalue()

        url = f"{IMAGE_API_BASE}/compose"
        files = {"image": ("input.png", img_bytes, "image/png")}
        data = {"text": new_text}
        resp = requests.post(url, headers=headers, files=files, data=data)

        if resp.status_code == 200:
            try:
                resp_json = resp.json()
                img_b64 = resp_json.get("image_base64")
                if img_b64:
                    updated_images[ad_id] = img_b64
                    print(f" 이미지 합성 성공 (adRunId={ad_id})")
                else:
                    print(f" 이미지 base64 없음 (adRunId={ad_id})")
            except Exception as e:
                print(f" 응답 JSON 파싱 실패 (adRunId={ad_id}): {e}")
        else:
            print(f" 이미지 합성 실패: {resp.status_code} - {resp.text}")

    context['ti'].xcom_push(key='updated_images', value=updated_images)


def update_ads(**context):
    """새 문구 + 이미지로 광고 업데이트"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"}

    ad_runs = context['ti'].xcom_pull(key='ad_runs', task_ids='fetch_ad_runs')
    updated_texts = context['ti'].xcom_pull(key='updated_texts', task_ids='generate_texts')
    updated_images = context['ti'].xcom_pull(key='updated_images', task_ids='compose_images')

    for ad in ad_runs:
        ad_run_id = str(ad["adRunId"])
        content_id = ad["contentId"]
        user_email = ad["userEmail"]

        new_text = updated_texts.get(ad_run_id)
        new_img_base64 = updated_images.get(ad_run_id)
        if not new_text or not new_img_base64:
            print(f" 업데이트 스킵 (adRunId={ad_run_id})")
            continue

        url = f"{API_BASE}/meta/update-ad"
        payload = {
            "adRunId": ad_run_id,
            "newContentId": content_id,
            "userEmail": user_email,
            "newText": new_text,
            "newImageBase64": new_img_base64,
        }

        resp = requests.post(url, headers=headers, json=payload)
        if resp.status_code == 200:
            print(f" 광고 업데이트 완료: adRunId={ad_run_id}")
        else:
            print(f" 광고 업데이트 실패: {resp.status_code} - {resp.text}")

# ========================
# DAG 정의
# ========================
default_args = {
    "owner": "airflow",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="ad_update_dag",
    default_args=default_args,
    description="AdRun 기반 자동 광고 업데이트 DAG",
    schedule_interval="0 */6 * * *",
    start_date=datetime(2025, 8, 25),
    catchup=False,
    tags=["ads", "automation"],
) as dag:

    fetch_jwt = PythonOperator(
        task_id="fetch_jwt",
        python_callable=fetch_jwt_token,
    )

    fetch_ad_runs = PythonOperator(
        task_id="fetch_ad_runs",
        python_callable=fetch_active_ad_runs,
    )

    generate_texts = PythonOperator(
        task_id="generate_texts",
        python_callable=generate_ad_text,
    )

    compose_images = PythonOperator(
        task_id="compose_images",
        python_callable=compose_image,
    )

    update_ads_task = PythonOperator(
        task_id="update_ads_task",
        python_callable=update_ads,
    )

    fetch_jwt >> fetch_ad_runs >> generate_texts >> compose_images >> update_ads_task
