# project

본 프로젝트를 실행하기위해서는 application.properties에 gpt api를 작성하고 백엔드, 파이썬 서버를 먼저 실행하고, 이후 프론트를 실행시켜 결과물을 확인해야합니다.

실행전 필요한 것들

- gpt api (결제 카드 등록을 해야합니다.)
- gemini(nano banana) api (결제 카드를 등록해야합니다.)
- 페이스북 광고 관리자를 통해 페이스북 엑세스 토큰 - 홈페이지에서 사용합니다.
- python 17 을 사용해야합니다.

---

## 파이썬 서버 실행 방법 (처음 설정 시) - vlm이 있으므로 gpu 필수

cd project_restored
cd pyserver
python -m venv .venv
.\.venv\Scripts\Activate.ps1 <-> deactivate(탈출)
pip install -r requirements.txt

# 2) vertex AI 클라이언트 설치 (vertexai 모듈 포함)

python -m pip install --upgrade google-cloud-aiplatform

# 3) (최초 1회) gcloud ADC 인증 + 프로젝트 설정

gcloud auth application-default login

gcloud config set project 내\_프로젝트\_ID #(google api 생성시 만든 프로젝트 id)
-> gcloud config set project nano-471710 #(예시)

## venv 활성화된 상태에서 설치 파일들

python -m pip install --upgrade pip
pip install --index-url https://download.pytorch.org/whl/cu124 torch torchvision torchaudio

pip install "git+https://github.com/huggingface/transformers"
pip install "git+https://github.com/huggingface/diffusers"
pip install accelerate qwen-vl-utils pillow
pip install hf_transfer
$env:HF_HUB_ENABLE_HF_TRANSFER = "1"

python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen2.5-VL-3B-Instruct')"

# 4) 실행

$env:GOOGLE_API_KEY = 'gemini api' #(gemini api 입력) AIzaSyDHLy5RDLf0tzbEeezIWke7gqCJqSrM4jo

$env:GOOGLE_CLOUD_PROJECT = "<내_프로젝트_ID>"     #(google api 생성시 만든 프로젝트 id)
$env:GOOGLE_CLOUD_PROJECT="nano-471710" #(예시)

$env:GOOGLE_CLOUD_LOCATION="global"
$env:GOOGLE_GENAI_USE_VERTEXAI = "False"

cd ad_generate
uvicorn compose_service:app --host 0.0.0.0 --port 8010 --reload

---

## 백엔드 실행

2. 스프링 백엔드(8080)
   cd project
   ./gradlew bootRun

application.properties에

compose.base-url=http://localhost:8010 있는지 확인.

---

## 프론트 실행

3. 프론트(3000)
   cd project\src\main\frontend_login
   npm install
   npm start
