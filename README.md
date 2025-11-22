# 📢 다중 모달 AI 기반 SNS 광고 자동 생성 및 배포 시스템

**(Fully Automated SNS Advertisement Generation and Deployment System Using Multimodal AI)**

## 📖 프로젝트 소개 (Project Description)

> **"소상공인을 위한 End-to-End AI 광고 운영 솔루션"**

현대 비즈니스에서 SNS 광고는 필수적이지만, 전문 지식이 없는 소상공인에게는 기획, 디자인, 배포, 성과 관리가 큰 부담으로 작용합니다. [cite_start]본 프로젝트는 **상품명과 상품 이미지**만 입력하면, AI가 자동으로 광고 콘텐츠를 생성하고 SNS에 배포하며, 성과를 분석하여 저조한 광고를 자동으로 교체하는 **완전 자동화 시스템**입니다. [cite: 10, 11]

[cite_start]기존 연구들이 단순한 광고 생성에 그쳤다면, 본 시스템은 **생성(Generation) → 배포(Deployment) → 평가(Evaluation) → 교체(Replacement)**로 이어지는 광고 운영의 전 과정을 자동화하여 사용자의 개입을 최소화하고 광고 효율을 극대화합니다. [cite: 12, 13]

### 💡 주요 기능 (Key Features)

- [cite_start]**최소한의 입력:** 복잡한 프롬프트 없이 '상품명'과 '이미지'만으로 고품질 광고 생성. [cite: 29]
- [cite_start]**멀티모달 AI 생성 파이프라인:** 광고 문구(Text), 레이아웃(Layout), 배경(Background)을 각기 다른 최적의 AI 모델이 생성 후 합성. [cite: 34]
- [cite_start]**성과 기반 자동 순환 (Closed-Loop Automation):** Apache Airflow를 통해 광고 성과(CTR)를 주기적으로 분석하고, 기준 미달 시 자동으로 새로운 광고로 교체. [cite: 65]
- [cite_start]**피로도 관리:** 동일 광고가 3주 이상 노출되면 자동으로 교체하여 광고 피로도(Ad Wearout) 방지. [cite: 72]

---

## 🛠 기술적 설명 (Technical Details)

[cite_start]본 시스템은 크게 **광고 콘텐츠 생성 모듈**과 **자동화 모듈**로 구성되어 있으며, 웹 기반의 통합 시스템으로 구현되었습니다. [cite: 76]

### 1. 광고 콘텐츠 생성 모듈 (Ad Content Generation Module)

[cite_start]Min Zhou의 프레임워크를 재정의하여 4단계 파이프라인으로 구축했습니다. [cite: 34]

- **Step 1: 광고 문구 생성 (Ad Text Generation)**

  - **Model:** `ChatGPT-4o API`
  - [cite_start]사용자 입력(제품명, 타겟, 목적, 키워드)을 바탕으로 혜택형, 구매 유도형, 신뢰형 등 목적에 맞는 3가지 유형의 광고 카피를 생성합니다. [cite: 43]

- **Step 2: 레이아웃 생성 (Layout Generation with LoRA)**

  - **Model:** `Qwen2.5-VL-3B-Instruct` (LoRA Fine-tuned)
  - [cite_start]텍스트와 이미지를 동시에 이해하는 멀티모달 모델을 사용합니다. [cite: 46]
  - **Core Tech (LoRA):** 기존 모델은 JSON 형식의 레이아웃 좌표를 정확히 출력하는 데 한계가 있어, PITA 데이터셋을 활용해 LoRA(Low-Rank Adaptation) 파이프튜닝을 진행했습니다. [cite_start]이를 통해 요소 겹침(Overlap)을 61% 감소시키고 시각적 안정성을 확보했습니다. [cite: 14, 138, 155]

- **Step 3: 배경 생성 (Background Generation)**

  - **Model:** `Nano-Banana` (Google Gemini 2.5 Flash Image)
  - [cite_start]레이아웃 단계에서 생성된 JSON 정보를 기반으로 제품을 부각시키는 최적의 배경 이미지를 생성합니다. [cite: 49, 91]

- **Step 4: 텍스트 렌더링 (Text Rendering & Composition)**
  - **Library:** `Python PIL (Pillow)`
  - 생성된 배경, 제품 누끼 이미지, 텍스트, 로고를 좌표에 맞춰 합성합니다. [cite_start]특히 한국어 인코딩 문제를 해결하고 디자인 컨텍스트에 맞는 폰트/색상을 적용하여 최종 결과물을 완성합니다. [cite: 56, 96]

### 2. 자동화 모듈 (Automation Module)

[cite_start]광고 집행의 전 과정을 **Apache Airflow** 기반의 DAG(Directed Acyclic Graph)로 관리합니다. [cite: 59]

- **데이터 흐름:** `Fetch` → `Evaluate` → `Generate` → `Update`
- **성과 기반 교체 로직 (Performance-based Replacement):**
  - [cite_start]Meta Graph API를 통해 수집된 CTR(클릭률)이 WordStream 기준 카테고리별 평균보다 낮을 경우 교체 대상으로 분류합니다. [cite: 65]
  - [cite_start]상품 설명을 KoNLPy(Okt)로 형태소 분석하여 카테고리를 자동 분류하고, 적절한 벤치마크와 비교합니다. [cite: 67, 68]
- **시간 기반 교체 로직 (Time-based Replacement):**
  - [cite_start]성과와 무관하게 노출 후 3주가 경과한 광고를 탐지하여 교체함으로써 사용자 피로 누적을 방지합니다. [cite: 73]

### 3. 기술 스택 (Tech Stack)

| 구분             | 기술 (Technology)                         | 설명                                                              |
| :--------------- | :---------------------------------------- | :---------------------------------------------------------------- |
| **Frontend**     | React                                     | [cite_start]사용자 입력 및 결과 확인 UI [cite: 77]                |
| **Backend**      | Java, Spring Boot                         | [cite_start]API 서버 및 비즈니스 로직 처리 [cite: 77]             |
| **AI Models**    | Qwen2.5-VL (LoRA), ChatGPT-4o, Gemini 2.5 | [cite_start]레이아웃, 텍스트, 배경 이미지 생성 [cite: 43, 45, 49] |
| **Automation**   | Apache Airflow, Python                    | [cite_start]광고 운영 프로세스 자동화 및 스케줄링 [cite: 59]      |
| **Database**     | MySQL, AWS RDS                            | [cite_start]광고 데이터 및 성과 지표 저장 [cite: 78]              |
| **External API** | Meta Graph API                            | [cite_start]Facebook 광고 배포 및 인사이트 수집 [cite: 127]       |

---

## 📊 성능 평가 (Evaluation)

[cite_start]LoRA 파이프튜닝을 적용한 `Ours(LoRA)` 모델은 기존 `Qwen2.5-VL` 대비 다음과 같은 성능 향상을 보였습니다. [cite: 153]

| Metric                | Qwen2.5-VL | Ours (LoRA) | 향상 효과                                                           |
| :-------------------- | :--------: | :---------: | :------------------------------------------------------------------ |
| **Ove (Overlap)**     |   0.0649   | **0.0253**  | [cite_start]요소 간 겹침 현상 대폭 감소 (낮을수록 좋음) [cite: 155] |
| **Rea (Readability)** |   0.6124   | **0.9767**  | [cite_start]가독성 크게 향상 [cite: 155]                            |
| **Und (Underlay)**    |   0.9442   | **0.9836**  | [cite_start]텍스트 배경 처리 개선 [cite: 155]                       |

---

## 🚀 향후 계획 (Future Work)

- [cite_start]**플랫폼 확장:** Instagram, Naver, Google 등 다양한 광고 플랫폼 연동 [cite: 169]
- [cite_start]**콘텐츠 고도화:** 정적 이미지뿐만 아니라 동적 비디오 광고 생성 기능 추가 [cite: 170]
- [cite_start]**워크플로우 개선:** n8n 도입을 통한 개발 및 유지보수 효율성 증대 [cite: 168]
