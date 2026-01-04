import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

// ===================== RunPod 설정 (환경 변수 사용) =====================
// .env 파일이나 Vercel 설정에서 값을 가져옵니다.
const RUNPOD_API_KEY = process.env.REACT_APP_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.REACT_APP_RUNPOD_ENDPOINT_ID;
// Endpoint ID가 있으면 URL을 조립하고, 없으면 빈 문자열 혹은 기본값(없음) 처리
const RUNPOD_URL = RUNPOD_ENDPOINT_ID
  ? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`
  : "";

// ===================== Header (기존 동일) =====================
function Header({ isLoggedIn, onLogout }) {
  const navLinkStyle = {
    color: "#374151",
    fontWeight: "500",
    fontSize: "15px",
    textDecoration: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    transition: "all 0.2s ease",
    cursor: "pointer",
  };

  const logoutButtonStyle = {
    color: "#fff",
    backgroundColor: "#8B3DFF",
    border: "none",
    borderRadius: "6px",
    padding: "8px 20px",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    transition: "background-color 0.2s ease",
  };

  return (
    <header
      style={{
        backgroundColor: "#ffffff",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #f3f4f6",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <Link
        to="/"
        style={{
          fontFamily: "serif",
          fontStyle: "italic",
          fontWeight: "700",
          fontSize: "1.5rem",
          color: "#00C4CC",
          textDecoration: "none",
          cursor: "pointer",
          letterSpacing: "-0.025em",
        }}
      >
        ADaide
      </Link>

      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/mypage" style={navLinkStyle}>
          마이페이지
        </Link>
        {isLoggedIn ? (
          <button style={logoutButtonStyle} onClick={onLogout}>
            로그아웃
          </button>
        ) : (
          <Link to="/auth/login" style={navLinkStyle}>
            로그인
          </Link>
        )}
      </nav>
    </header>
  );
}

// ===================== Footer (기존 동일) =====================
function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#ffffff",
        borderTop: "1px solid #f3f4f6",
        color: "#6b7280",
        fontSize: "0.875rem",
        padding: "48px 0",
        textAlign: "center",
        marginTop: "auto",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <p style={{ marginBottom: "8px" }}>
        © 2025 AI Ad Manager. All rights reserved.
      </p>
      <p>대표: 장민서 | 대표 메일: msj3767@gmail.com</p>
    </footer>
  );
}

// ===================== Helper: File to Base64 =====================
const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result); // "data:image/png;base64,..."
    reader.onerror = (error) => reject(error);
  });
};

// ===================== ImageGenerator 컴포넌트 =====================
function ImageGenerator() {
  const navigate = useNavigate();

  const [selectedAdText, setSelectedAdText] = useState(null);
  const [textGenParams, setTextGenParams] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [originalBase64, setOriginalBase64] = useState(null);
  const [resultUrl, setResultUrl] = useState(null); // 최종 결과 이미지
  const [resultLayout, setResultLayout] = useState(null); // (선택) 레이아웃 정보 저장용

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [statusMessage, setStatusMessage] = useState(""); // 진행 상태 메시지
  const [error, setError] = useState("");

  const handleHeaderLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login");
  };

  useEffect(() => {
    const storedText = localStorage.getItem("selectedAdText");
    const storedParams = localStorage.getItem("textGenParams");

    if (storedText) {
      setSelectedAdText(storedText);
    } else {
      alert("선택된 문구가 없습니다. 문구 생성 페이지로 이동합니다.");
      navigate("/text-generator");
      return;
    }

    if (storedParams) {
      try {
        setTextGenParams(JSON.parse(storedParams));
      } catch (e) {
        console.error("Failed to parse textGenParams from localStorage", e);
        setTextGenParams(null);
      }
    }
  }, [navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // 미리보기용 저장
        const base64Full = reader.result;
        const base64Raw = base64Full.split(",")[1];
        setOriginalBase64(base64Raw);
      };
      reader.readAsDataURL(file);
    }
  };

  // ★★★ RunPod과 통신하는 핵심 함수 ★★★
  const handleCompose = async () => {
    try {
      setError("");
      setIsLoading(true);
      setStatusMessage("이미지 업로드 및 작업 요청 중...");

      if (!RUNPOD_API_KEY || !RUNPOD_URL) {
        setError(
          "서버 설정 오류: API Key 또는 Endpoint ID가 설정되지 않았습니다."
        );
        setIsLoading(false);
        return;
      }

      if (!imageFile) {
        setError("이미지를 먼저 선택해주세요.");
        setIsLoading(false);
        return;
      }

      if (!selectedAdText) {
        setError("문구가 없습니다.");
        setIsLoading(false);
        return;
      }

      // 1. 이미지를 Base64로 변환
      const imageBase64Full = await convertToBase64(imageFile);

      // 2. 요청 Payload 구성
      const payload = {
        input: {
          image: imageBase64Full,
          product_name: textGenParams?.product || "Product",
          headline: selectedAdText,
        },
      };

      // 3. RunPod에 작업 요청 (Run)
      const runRes = await axios.post(`${RUNPOD_URL}/run`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      const jobId = runRes.data.id;
      console.log(`RunPod 작업 시작: ${jobId}`);
      setStatusMessage(
        "AI가 이미지를 분석하고 합성 중입니다... (약 30초 소요)"
      );

      // 4. 결과 대기 (Polling)
      let status = "IN_PROGRESS";
      let finalOutput = null;

      while (status !== "COMPLETED" && status !== "FAILED") {
        await new Promise((r) => setTimeout(r, 2000)); // 2초 대기

        const statusRes = await axios.get(`${RUNPOD_URL}/status/${jobId}`, {
          headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
        });

        status = statusRes.data.status;
        console.log(`작업 상태: ${status}`);

        if (status === "COMPLETED") {
          finalOutput = statusRes.data.output;
        } else if (status === "FAILED") {
          setError("AI 서버 작업이 실패했습니다.");
          console.error("RunPod Error:", statusRes.data);
          break;
        }
      }

      // 5. 결과 처리
      if (finalOutput) {
        if (finalOutput.error) {
          setError(`서버 내부 오류: ${finalOutput.error}`);
        } else if (finalOutput.image) {
          setResultUrl(`data:image/png;base64,${finalOutput.image}`);
          setResultLayout(finalOutput.layout);
          setStatusMessage("완료!");
        } else {
          setError("결과 이미지가 없습니다.");
        }
      }
    } catch (err) {
      console.error("이미지 합성 오류:", err);
      setError("통신 중 오류가 발생했습니다. (API Key 등을 확인해주세요)");
    } finally {
      setIsLoading(false);
      if (!error) setStatusMessage("");
    }
  };

  const handleGoFacebook = () => {
    if (!resultUrl) {
      alert("이미지를 먼저 합성해 주세요.");
      return;
    }
    navigate("/facebook-input", {
      state: {
        adText: selectedAdText ?? "",
        imageUrl: resultUrl,
      },
    });
  };

  const handleSaveContent = async () => {
    if (!resultUrl) {
      alert("저장할 합성된 이미지가 없습니다. 이미지를 먼저 생성해주세요! 🙅‍♀️");
      return;
    }

    setIsSavingContent(true);

    const token = localStorage.getItem("jwtToken");
    if (!token) {
      alert("로그인이 필요합니다. 다시 로그인해주세요!");
      setIsSavingContent(false);
      return;
    }

    try {
      const cleanedBase64Image = resultUrl.split(",")[1];

      const savePayload = {
        product: textGenParams?.product || "",
        target: textGenParams?.target || "",
        purpose: textGenParams?.purpose || "",
        keyword: textGenParams?.keyword || "",
        duration: textGenParams?.duration || "",
        adText: selectedAdText,
        generatedImageBase64: cleanedBase64Image,
        originalImageBase64: originalBase64,
      };

      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";
      const response = await axios.post(
        `${apiUrl}/api/ad-content/save`,
        savePayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("광고 콘텐츠 저장 응답:", response.data);
      alert("광고 콘텐츠가 성공적으로 저장되었습니다! ✅");
    } catch (error) {
      console.error("광고 콘텐츠 저장 중 오류 발생:", error);
      const errorMessage = error.response?.data?.message || "저장 중 오류 발생";
      alert(errorMessage);
    } finally {
      setIsSavingContent(false);
    }
  };

  if (selectedAdText === null) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px", color: "#666" }}>
        데이터를 불러오는 중입니다...
      </div>
    );
  }

  // ================= 스타일 객체 =================
  const pageContainerStyle = {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: "#F9FAFB",
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  const mainContentStyle = {
    flexGrow: 1,
    padding: "60px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const contentWrapperStyle = {
    display: "flex",
    flexDirection: "row",
    gap: "30px",
    width: "100%",
    maxWidth: "1100px",
    justifyContent: "center",
    alignItems: "flex-start",
    flexWrap: "wrap",
  };

  const cardBaseStyle = {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  const inputCardStyle = {
    ...cardBaseStyle,
    flex: "1 1 400px",
    maxWidth: "600px",
  };

  const resultCardStyle = {
    ...cardBaseStyle,
    flex: "1 1 400px",
    maxWidth: "600px",
  };

  const titleStyle = {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "20px",
    textAlign: "center",
  };

  const infoBoxStyle = {
    marginBottom: "24px",
    padding: "16px",
    backgroundColor: "#F3F4F6",
    borderLeft: "4px solid #8B3DFF",
    borderRadius: "4px",
    color: "#374151",
    fontSize: "0.95rem",
    textAlign: "left",
    lineHeight: "1.5",
  };

  const fileInputStyle = {
    marginBottom: "20px",
    padding: "10px",
    border: "1px dashed #D1D5DB",
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#FAFAFA",
  };

  const getButtonStyle = (bgColor, disabled) => ({
    width: "100%",
    padding: "14px",
    backgroundColor: disabled ? "#E5E7EB" : bgColor,
    color: disabled ? "#9CA3AF" : "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "700",
    cursor: disabled ? "not-allowed" : "pointer",
    marginBottom: "12px",
    transition: "all 0.2s ease",
  });

  return (
    <div style={pageContainerStyle}>
      <Header
        isLoggedIn={Boolean(localStorage.getItem("jwtToken"))}
        onLogout={handleHeaderLogout}
      />

      <main style={mainContentStyle}>
        <div style={contentWrapperStyle}>
          {/* ============ 왼쪽 패널 ============ */}
          <div style={inputCardStyle}>
            <h2 style={titleStyle}>광고 이미지 합성기</h2>

            <div style={infoBoxStyle}>
              <div style={{ fontWeight: "700", marginBottom: "4px" }}>
                📢 선택된 문구
              </div>
              {selectedAdText}
              {textGenParams && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#6B7280",
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid #E5E7EB",
                  }}
                >
                  옵션: {textGenParams.product} | {textGenParams.benefit} |{" "}
                  {textGenParams.painPoint}
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={fileInputStyle}
            />

            {originalBase64 && (
              <div style={{ marginBottom: "20px", textAlign: "center" }}>
                <img
                  src={`data:image/png;base64,${originalBase64}`}
                  alt="Uploaded"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "250px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            )}

            <button
              onClick={handleCompose}
              disabled={isLoading || !selectedAdText}
              style={getButtonStyle("#8B3DFF", isLoading || !selectedAdText)}
            >
              {isLoading ? statusMessage || "작업 중..." : "이미지 합성하기"}
            </button>

            <button
              onClick={handleGoFacebook}
              disabled={isLoading || !resultUrl}
              style={getButtonStyle("#1877f2", isLoading || !resultUrl)}
            >
              Facebook으로 광고하러 하기
            </button>

            {error && (
              <div
                style={{
                  marginTop: "10px",
                  color: "#DC2626",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                }}
              >
                {error}
              </div>
            )}

            {!error && isLoading && (
              <div
                style={{
                  marginTop: "10px",
                  color: "#6B7280",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {statusMessage}
              </div>
            )}
          </div>

          {/* ============ 오른쪽 패널 ============ */}
          {resultUrl && (
            <div style={resultCardStyle}>
              <h2 style={{ ...titleStyle, marginBottom: "30px" }}>합성 결과</h2>

              <div style={{ textAlign: "center", flexGrow: 1 }}>
                <img
                  src={resultUrl}
                  alt="Composite Ad"
                  style={{
                    maxWidth: "100%",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    marginBottom: "30px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
              </div>

              <div style={{ marginTop: "auto" }}>
                <button
                  onClick={handleSaveContent}
                  disabled={isSavingContent}
                  style={getButtonStyle("#10B981", isSavingContent)}
                >
                  {isSavingContent ? "저장 중..." : "광고 콘텐츠 저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ImageGenerator;
