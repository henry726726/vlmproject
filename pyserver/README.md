# FastAPI + Stable Diffusion ControlNet 서버

## 실행 방법 (처음 설정 시)

```bash
cd project_restored
cd pyserver
python -m venv .venv
.\.venv\Scripts\Activate.ps1    <> deactivate
pip install -r requirements.txt


# 2) vertex AI 클라이언트 설치 (vertexai 모듈 포함)
python -m pip install --upgrade google-cloud-aiplatform

# 3) (최초 1회) gcloud ADC 인증 + 프로젝트 설정
gcloud auth application-default login
gcloud config set project nano-471710

## venv 활성화된 상태에서 설치 파일들
python -m pip install --upgrade pip
pip install --index-url https://download.pytorch.org/whl/cu124 torch torchvision torchaudio



pip install "git+https://github.com/huggingface/transformers"
pip install "git+https://github.com/huggingface/diffusers"
pip install accelerate qwen-vl-utils pillow
pip install hf_transfer
$env:HF_HUB_ENABLE_HF_TRANSFER = "1"

# (권장) 3B 먼저 캐시 — 8GB VRAM에서 안정적
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen2.5-VL-3B-Instruct')"




# 4) 실행
$env:GOOGLE_API_KEY = ''

# $env:GOOGLE_CLOUD_PROJECT = "<내_프로젝트_ID>"
$env:GOOGLE_CLOUD_PROJECT="nano-471710"
$env:GOOGLE_CLOUD_LOCATION="global"
$env:GOOGLE_GENAI_USE_VERTEXAI = "False"


uvicorn compose_service:app --host 0.0.0.0 --port 8010 --reload
```

Test-Path .\.venv\Scripts\Activate.ps1

시작(재현) 절차 요약 — Windows PowerShell 0) 공통 환경변수 (Vertex 사용 시)

# Vertex 쓸 때(프로젝트/리전 본인 환경으로!):

$env:GOOGLE_CLOUD_PROJECT = "<내_프로젝트_ID>"
$env:GOOGLE_CLOUD_LOCATION = "us-central1" # 또는 global (모델 가용성에 맞춰)

2. 스프링 백엔드(8080)
   cd C:\Users\msj37\mvp_final\project
   ./gradlew bootRun

application.properties에

compose.base-url=http://localhost:8010

있는지 확인.

3. 프론트(3000)
   cd C:\Users\msj37\mvp_final\project\src\main\frontend_login
   npm start
