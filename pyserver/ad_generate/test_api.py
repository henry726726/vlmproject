import requests
import time
import json

# ==========================================
# 1. 사용자 설정 (이 부분만 본인 것으로 바꾸세요)
# ==========================================



# 테스트할 이미지 (예시: 강아지와 소녀)
TEST_IMAGE_URL = "https://raw.githubusercontent.com/QwenLM/Qwen-VL/master/assets/demo.jpeg"

# ==========================================
# 2. 요청 보내기
# ==========================================
BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "input": {
        "image": TEST_IMAGE_URL,
        "product_name": "Test Product",
        "no_rules": False,
        "bg_prompt": True 
    }
}

print(f"🚀 [1/3] 서버({ENDPOINT_ID})에 요청 전송 중...")
try:
    # 1. 실행 요청 (run)
    response = requests.post(f"{BASE_URL}/run", headers=HEADERS, json=payload)
    response.raise_for_status() 
    
    data = response.json()
    job_id = data['id']
    print(f"✅ 작업 접수 완료! Job ID: {job_id}")
    
    # 2. 결과 기다리기 (status polling)
    print("⏳ [2/3] AI가 생각하는 중... (약 10~30초 소요)")
    while True:
        status_res = requests.get(f"{BASE_URL}/status/{job_id}", headers=HEADERS)
        status_data = status_res.json()
        status = status_data['status']
        
        if status == 'COMPLETED':
            print("\n🎉 [3/3] 성공! 결과 도착:")
            print("="*50)
            print(json.dumps(status_data['output'], indent=2, ensure_ascii=False))
            print("="*50)
            break
            
        elif status == 'FAILED':
            print("\n❌ 실패했습니다.")
            print("에러 내용:", status_data)
            break
            
        else:
            print(".", end="", flush=True) # 대기 중 점 찍기
            time.sleep(2)

except Exception as e:
    print(f"\n❌ 통신 에러 발생: {e}")