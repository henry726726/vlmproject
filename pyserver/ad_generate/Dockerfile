# 1. 베이스 이미지 (RunPod 공식 PyTorch 이미지 사용)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 필수 라이브러리 설치
# (캐싱을 위해 requirements 먼저 복사)
COPY builder.txt .
RUN pip install --no-cache-dir -r builder.txt



# 5. 내 소스코드 복사
COPY handler.py .

# 6. 실행 명령어 (핸들러 실행)
CMD [ "python", "-u", "handler.py" ]