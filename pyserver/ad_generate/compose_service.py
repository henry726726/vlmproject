
import os
import sys
import json
import base64
import tempfile
import subprocess
import logging
import mimetypes
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

app = FastAPI(title="Compose Orchestrator", version="1.1.0")

# ----------------------------
# 로깅
# ----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("compose")

# ----------------------------
# 환경설정
# ----------------------------
BG_MODEL   = os.getenv("COMPOSE_BG_MODEL", "gemini-2.5-flash-image-preview")
QWEN_SCRIPT = os.getenv("COMPOSE_QWEN_SCRIPT", "qwen25_vl_layout_hybrid.py")
NANO_SCRIPT = os.getenv("COMPOSE_NANOBANANA_SCRIPT", "nano_banana_generate.py")
TEXT_SCRIPT = os.getenv("COMPOSE_TEXTRENDER_SCRIPT", "ad_text_render.py")

QWEN_DIR = os.path.dirname(os.path.abspath(QWEN_SCRIPT)) or os.getcwd()
NANO_DIR = os.path.dirname(os.path.abspath(NANO_SCRIPT)) or os.getcwd()
TEXT_DIR = os.path.dirname(os.path.abspath(TEXT_SCRIPT)) or os.getcwd()

SKIP_VERTEX_ENV_CHECK = os.getenv("COMPOSE_SKIP_VERTEX_ENV_CHECK", "0") == "1"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_methods=["*"],
    allow_headers=["*"]
)

# ----------------------------
# 공용 유틸
# ----------------------------
# compose_service.py
import os, sys, subprocess, io, threading

def run_argv(argv, timeout_s=1800, cwd=None, env=None, stream_prefix=None):
    merged_env = {**os.environ, **(env or {})}
    merged_env.update({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})

    proc = subprocess.Popen(
        argv,
        cwd=cwd,
        env=merged_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1,                  
        text=False,                 
        creationflags=(subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0),
    )

    stdout_t = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="backslashreplace", newline="")
    stderr_t = io.TextIOWrapper(proc.stderr, encoding="utf-8", errors="backslashreplace", newline="")

    out_lines, err_lines = [], []

    def pump(src, collector, is_err=False):
        for line in src:
            collector.append(line)
            if stream_prefix:
                if is_err:
                    print(f"{stream_prefix} STDERR: {line.rstrip()}", file=sys.stderr)
                else:
                    print(f"{stream_prefix} STDOUT: {line.rstrip()}")
        src.close()

    t1 = threading.Thread(target=pump, args=(stdout_t, out_lines, False), daemon=True)
    t2 = threading.Thread(target=pump, args=(stderr_t, err_lines, True), daemon=True)
    t1.start(); t2.start()

    try:
        ret = proc.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        ret = proc.wait()

    t1.join(); t2.join()

    out_text = "".join(out_lines)
    err_text = "".join(err_lines)
    return ret, out_text, err_text




def _check_vertex_env_or_400():
    if SKIP_VERTEX_ENV_CHECK:
        return
    required_env = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "GOOGLE_GENAI_USE_VERTEXAI"]
    missing = [k for k in required_env if not os.getenv(k)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing env for Step2: {', '.join(missing)}")

@app.get("/health")
def health():
    return {"status": "ok"}

# ----------------------------
# 핵심 엔드포인트 
# ----------------------------
@app.post("/compose")
async def compose(
    # 파일은 image 또는 image_file 둘 다 허용(프론트/백엔드 호환)
    image: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None),

    # 문자열 파라미터 (둘 다 허용)
    product: Optional[str] = Form(None),
    text: str = Form(""),          # 프론트에서 쓰던 이름
    caption: str = Form(""),       # 호환용(백엔드에서 caption을 쓰는 경우)

    # 추가 옵션
    product_name: str = Form(""),
    headline: str = Form(""),
    logo_path: str = Form(""),
    font_kor: str = Form(r"C:\Windows\Fonts\malgunbd.ttf"),
):
    # 0) 입력 유효성
    resolved_file = image or image_file
    if resolved_file is None:
        raise HTTPException(status_code=400, detail="image (or image_file) is required")

    # caption/text/headline 중 우선순위로 문구 결정
    resolved_headline = (text or caption or headline).strip()
    resolved_product = (product or "").strip()

    # 1) Step2 환경 (Vertex/GenAI) 체크
    _check_vertex_env_or_400()

    # 2) 임시 작업 디렉터리
    with tempfile.TemporaryDirectory() as td:
        # 2-1) 입력 이미지 저장
        raw = await resolved_file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="uploaded file is empty")

        guessed_ext = mimetypes.guess_extension(resolved_file.content_type or "") \
                      or os.path.splitext(resolved_file.filename or "")[1] \
                      or ".bin"
        img_path     = os.path.join(td, f"input{guessed_ext}")
        layout_json  = os.path.join(td, "layout_with_bg.json")
        stage3_path  = os.path.join(td, "stage3.png")
        final_path   = os.path.join(td, "final_ad.png")
        copy_json    = os.path.join(td, "copy.json")

        with open(img_path, "wb") as f:
            f.write(raw)

        # 3) Step1 — 레이아웃 생성
        argv1 = [
            sys.executable, QWEN_SCRIPT,
            "--image", img_path,
            "--bg_prompt",
            "--save", layout_json,
            "--product_name", (resolved_product or "")
        ]
        if resolved_product:
            argv += ["--product_name", resolved_product] 

        # compose() 안, Step1 호출 직후
        out1, err1, rc1 = run_argv(argv1, cwd=QWEN_DIR, timeout_s=1800)

        # 파일 존재/사이즈 검증
        if not os.path.exists(layout_json) or os.path.getsize(layout_json) < 10:
            log.error("Step1 produced no layout json. head(stdout)=%s", (out1 or "")[:1000])
            raise HTTPException(
                status_code=500,
                detail="Step1 (Qwen) did not generate layout JSON. See server logs."
            )



        # 4) Step2 — 배경 합성
        argv2 = [
            sys.executable, NANO_SCRIPT,
            "--image", img_path,
            "--layout_json", layout_json,
            "--out", stage3_path,
            "--model", BG_MODEL
        ]
        run_argv(argv2, cwd=NANO_DIR)

        # 5) Step2.5 — copy.json 구성 (headline만 우선 매핑)
        copy_map = {}
        if resolved_headline:
            copy_map["headline#0"] = resolved_headline
        with open(copy_json, "w", encoding="utf-8") as f:
            json.dump(copy_map, f, ensure_ascii=False, indent=2)

        # 6) Step3 — 텍스트/로고 렌더링
        argv3 = [
            sys.executable, TEXT_SCRIPT,
            "--image", stage3_path,
            "--layout_json", layout_json,
            "--copy_json", copy_json,
            "--font_kor", font_kor,
            "--out", final_path,
            "--skip_layout_underlays"
        ]
        if logo_path and logo_path.strip():
            argv3.insert(len(argv3)-2, "--logo_path")
            argv3.insert(len(argv3)-2, logo_path.strip())
        run_argv(argv3, cwd=TEXT_DIR)

        # 7) 결과 수집: 이미지 base64 + 레이아웃/카피 JSON + 메타
        try:
            with open(layout_json, "r", encoding="utf-8") as lf:
                layout_obj = json.load(lf)
        except Exception:
            layout_obj = None

        try:
            with open(copy_json, "r", encoding="utf-8") as cf:
                copy_obj = json.load(cf)
        except Exception:
            copy_obj = None

        with open(final_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        meta = {
            "model": {
                "bg_model": BG_MODEL,
                "qwen_script": os.path.basename(QWEN_SCRIPT),
                "nano_script": os.path.basename(NANO_SCRIPT),
                "text_script": os.path.basename(TEXT_SCRIPT),
            },
            "args": {
                "product": resolved_product,
                "headline": resolved_headline,
                "logo_path": logo_path.strip() if logo_path else "",
                "font_kor": font_kor,
            }
        }

        return {
            "image_base64": b64,
            "layout": layout_obj,
            "copy": copy_obj,
            "meta": meta
        }

# ----------------------------
# 호환용 간단 엔드포인트 (/generate)
# caption + image만 받아서 위 compose 로직을 재사용
# ----------------------------
@app.post("/generate")
async def generate(
    caption: str = Form(""),
    image: UploadFile = File(...),
    product: Optional[str] = Form(None), 
):
    # 내부적으로 /compose와 동일한 처리 경로 사용
    return await compose(
        image=image,
        image_file=None,
        product="",
        text=caption,
        caption=caption,
        product_name="",
        headline="",
        logo_path="",
        font_kor=r"C:\Windows\Fonts\malgunbd.ttf",
    )

# ----------------------------
# uvicorn으로 직접 실행할 때 편의용
# ----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("compose_service:app", host="0.0.0.0", port=8010, reload=True)