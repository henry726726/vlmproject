# dags/ad_insight_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from PIL import Image
from datetime import datetime, timedelta
import requests
import re
import os
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
        raise ValueError("❌ JWT 토큰 발급 실패")

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


def fetch_and_save_insights(**context):
    """백엔드 API 호출 → 각 광고 성과 저장 트리거"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"} 

    ad_runs = context['ti'].xcom_pull(key='ad_runs', task_ids='fetch_ad_runs')

    for ad in ad_runs:
        ad_run_id = ad.get("adRunId")
        ad_id = ad.get("adId")

        if not ad_id:
            print(f"⚠️ adRunId={ad_run_id} → adId 없음, 건너뜀")
            continue

        try:
            #  백엔드에 직접 성과 수집 + 저장 요청
            url = f"{API_BASE}/meta/insights/fetch-and-save"
            payload = {"adRunId": ad_run_id}  # adRunId만 주면 백엔드에서 user → accessToken 매핑
            resp = requests.post(url, headers=headers, json=payload)

            if resp.status_code == 200:
                print(f"📊 성과 수집 & 저장 완료 (adRunId={ad_run_id}, adId={ad_id})")
            else:
                print(f"❌ 성과 저장 실패: {resp.status_code} - {resp.text}")

        except Exception as e:
            print(f"❌ 성과 API 호출 실패 (adRunId={ad_run_id}): {e}")


def evaluate_ads(**context):
    """광고 성과 평가 후 교체 대상 선별"""
    jwt_token = context['ti'].xcom_pull(key="jwt_token", task_ids="fetch_jwt")
    headers = {"Authorization": f"Bearer {jwt_token}"} 

    ad_runs = context['ti'].xcom_pull(key='ad_runs', task_ids='fetch_ad_runs')
    replacement_candidates = []

    # 🔹 업계 평균 CTR을 백엔드 API에서 가져오기
    try:
        industry_resp = requests.get(f"{API_BASE}/api/industry-ctr", headers=headers)
        if industry_resp.status_code == 200:
            industry_ctr = industry_resp.json()
        else:
            print(f"⚠️ 업계 CTR API 호출 실패: {industry_resp.status_code}")
            industry_ctr = {"default": 0.02}
    except Exception as e:
        print(f"❌ 업계 CTR API 오류: {e}")
        industry_ctr = {"default": 0.02}

    for ad in ad_runs:
        ad_id = ad.get("adId")
        product = ad.get("product", "default")
        if not ad_id:
            continue

        #  광고 성과 가져오기
        url = f"{API_BASE}/meta/insights/{ad_id}/latest"
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            print(f"⚠️ 성과 불러오기 실패: adId={ad_id}")
            continue

        insight = resp.json()
        ctr = float(insight.get("ctr", 0))

        #  카테고리 매핑 (CategoryMappingController 활용)
        try:
            map_url = f"{API_BASE}/api/category-map?product={product}"
            map_resp = requests.get(map_url, headers=headers)
            if map_resp.status_code == 200:
                matched_category = map_resp.text.strip('"')
            else:
                matched_category = "default"
        except Exception:
            matched_category = "default"

        #  임계값 가져오기
        threshold = industry_ctr.get(matched_category, industry_ctr["default"])

        print(f" adId={ad_id}, CTR={ctr:.4f}, 기준={threshold:.4f}, 카테고리={matched_category}")

        if ctr < threshold:
            print(f" 교체 필요 → adId={ad_id}")
            replacement_candidates.append(ad)
        else:
            print(f" 유지 → adId={ad_id}")

    context['ti'].xcom_push(key='replacement_candidates', value=replacement_candidates)

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
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="ad_insight_dag",
    default_args=default_args,
    description="광고 성과 자동 수집 및 교체 DAG",
    schedule_interval="0 */6 * * *",  # 6시간마다 실행
    start_date=datetime(2025, 9, 1),
    catchup=False,
    tags=["ads", "insights"],
) as dag:

    # JWT 토큰 발급
    fetch_jwt = PythonOperator(
        task_id="fetch_jwt",
        python_callable=fetch_jwt_token,
    )

    # 광고 목록 조회
    fetch_ad_runs = PythonOperator(
        task_id="fetch_ad_runs",
        python_callable=fetch_active_ad_runs,
    )

    # 성과 수집 & 저장
    fetch_and_save_insights_task = PythonOperator(
        task_id="fetch_and_save_insights",
        python_callable=fetch_and_save_insights,
    )

    # 성과 평가
    evaluate_ads_task = PythonOperator(
        task_id="evaluate_ads",
        python_callable=evaluate_ads,
    )

    # 새 문구 생성
    generate_texts = PythonOperator(
        task_id="generate_texts",
        python_callable=generate_ad_text,
    )

    # 이미지 합성
    compose_images = PythonOperator(
        task_id="compose_images",
        python_callable=compose_image,
    )

    # 광고 업데이트
    update_ads_task = PythonOperator(
        task_id="update_ads_task",
        python_callable=update_ads,
    )

    # DAG 실행 순서 정의
    fetch_jwt >> fetch_ad_runs >> fetch_and_save_insights_task >> evaluate_ads_task >> generate_texts >> compose_images >> update_ads_task