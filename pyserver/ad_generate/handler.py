import runpod
import os
import json
import base64
import tempfile
import subprocess
import sys

# 1. 우리가 만든 Qwen 로직 임포트 (qwen_logic.py 파일이 있어야 함)
from qwen_logic import load_model, generate_layout

# 2. 외부 스크립트 파일명
NANO_SCRIPT = "nano_banana_generate.py"
TEXT_SCRIPT = "ad_text_render.py"
# 리눅스 컨테이너의 기본 폰트 경로 (Dockerfile에서 fonts-dejavu 설치함)
FONT_PATH = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

# 3. 모델 전역 로딩 (컨테이너 시작 시 1회만 실행됨 -> Qwen 15GB 로딩)
try:
    print("--- [Init] Loading Qwen Model ---")
    MODEL, PROCESSOR = load_model()
    print("--- [Init] Model Ready ---")
except Exception as e:
    print(f"--- [Init Error] {e}")
    sys.exit(1)

# ---------------------------
# 유틸: 이미지 저장
# ---------------------------
def save_b64_image(b64_data, ext=".png"):
    if "," in b64_data:
        b64_data = b64_data.split(",")[1]
    img_bytes = base64.b64decode(b64_data)
    t = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    t.write(img_bytes)
    t.close()
    return t.name

# ---------------------------
# 유틸: 외부 스크립트 실행 (subprocess)
# ---------------------------
def run_script(cmd):
    print(f"Running Command: {' '.join(cmd)}")
    # 텍스트 모드로 실행하여 로그 캡처
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    
    # 스크립트 내부 로그 출력 (디버깅용)
    if result.stdout:
        print(f"[Script Output]\n{result.stdout}")
    if result.stderr:
        print(f"[Script Error/Log]\n{result.stderr}")
        
    if result.returncode != 0:
        raise Exception(f"Script Failed with return code {result.returncode}")
    return result.stdout

# ---------------------------
# 메인 핸들러
# ---------------------------
def handler(job):
    job_input = job["input"]
    
    # 1. 입력 파싱
    image_b64 = job_input.get("image")
    product_name = job_input.get("product_name", "")
    headline = job_input.get("headline", "")
    
    if not image_b64:
        return {"error": "No image provided"}

    tmp_dir = tempfile.mkdtemp()
    print(f"--- Working Directory: {tmp_dir} ---")
    
    img_path = None
    try:
        # 2. 이미지 파일 저장 (Input)
        img_path = save_b64_image(image_b64)
        print(f"--- Image saved at: {img_path} ---")
        
        # ---------------------------
        # STEP 1: Qwen Layout (메모리에 있는 모델 사용)
        # ---------------------------
        print("--- [Step 1] Generating Layout (Qwen) ---")
        # qwen_logic.py의 함수 호출
        layout_result = generate_layout(MODEL, PROCESSOR, img_path, product_name=product_name)
        
        # 레이아웃 JSON 파일 저장 (다음 단계 스크립트가 읽어야 함)
        layout_json_path = os.path.join(tmp_dir, "layout.json")
        with open(layout_json_path, "w", encoding='utf-8') as f:
            json.dump(layout_result, f, ensure_ascii=False, indent=2)
        print("--- Layout JSON saved ---")

        # ---------------------------
        # STEP 2: Background Gen (외부 스크립트 실행)
        # ---------------------------
        stage3_path = os.path.join(tmp_dir, "stage3.png")
        
        if os.path.exists(NANO_SCRIPT):
            print("--- [Step 2] Generating Background (NanoBanana) ---")
            # nano_banana_generate.py 실행
            run_script([
                "python", NANO_SCRIPT,
                "--image", img_path,
                "--layout_json", layout_json_path,
                "--out", stage3_path,
                "--model", "gemini-2.0-flash-exp" # 혹은 사용하시는 모델명
            ])
        else:
            print(f"⚠️ Warning: {NANO_SCRIPT} not found. Skipping Step 2.")
            stage3_path = img_path # 실패 시 원본 사용

        # ---------------------------
        # STEP 3: Text Rendering (외부 스크립트 실행)
        # ---------------------------
        # Copy JSON 생성 (헤드라인 전달용)
        copy_json_path = os.path.join(tmp_dir, "copy.json")
        with open(copy_json_path, "w", encoding='utf-8') as f:
            json.dump({"headline#0": headline}, f, ensure_ascii=False)

        final_path = os.path.join(tmp_dir, "final_ad.png")
        
        if os.path.exists(TEXT_SCRIPT):
            print("--- [Step 3] Rendering Text (PIL) ---")
            # ad_text_render.py 실행
            run_script([
                "python", TEXT_SCRIPT,
                "--image", stage3_path,
                "--layout_json", layout_json_path,
                "--copy_json", copy_json_path,
                "--font_kor", FONT_PATH,
                "--out", final_path,
                "--skip_layout_underlays"
            ])
        else:
             print(f"⚠️ Warning: {TEXT_SCRIPT} not found. Skipping Step 3.")
             final_path = stage3_path

        # ---------------------------
        # 결과 반환
        # ---------------------------
        if os.path.exists(final_path):
            print("--- [Success] Final Image Created ---")
            with open(final_path, "rb") as f:
                final_b64 = base64.b64encode(f.read()).decode('utf-8')
            
            # 최종 결과 리턴
            return {
                "image": final_b64,
                "layout": layout_result
            }
        else:
            print("--- [Error] Final Image Not Found ---")
            return {"error": "Failed to generate final image", "layout": layout_result}

    except Exception as e:
        print(f"--- [Handler Error] {e} ---")
        return {"error": str(e)}
    finally:
        # 임시 파일 정리
        if img_path and os.path.exists(img_path): os.remove(img_path)
        # tmp_dir 등은 OS가 알아서 정리하거나, 필요시 shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})