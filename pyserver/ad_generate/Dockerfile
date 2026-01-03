# 1. 베이스 이미지 (RunPod 공식 PyTorch 이미지 사용)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# 2. 작업 디렉토리
WORKDIR /app

# 3. 시스템 패키지 설치 (★ fonts-nanum 추가됨 ★)
# fonts-dejavu: 영어용
# fonts-nanum: 한글용 (나눔고딕, 나눔명조 등 포함)
# libgl1-mesa-glx: OpenCV용
RUN apt-get update && apt-get install -y \
    fonts-dejavu \
    fonts-nanum \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# 4. 파이썬 라이브러리 설치
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.45.0 \
    accelerate>=0.26.0 \
    qwen-vl-utils \
    pillow \
    numpy \
    requests \
    scipy \
    torchvision \
    fastapi \
    uvicorn \
    python-multipart \
    google-genai \
    openai \
    opencv-python-headless

# 5. 소스 코드 복사
COPY qwen_logic.py handler.py nano_banana_generate.py ad_text_render.py ./

# 6. 실행
CMD [ "python", "-u", "handler.py" ]