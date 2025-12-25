import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

// ===================== Header (통일된 밝은 테마) =====================
function Header({ isLoggedIn, onLogout }) {
  const navLinkStyle = {
    color: "#374151", // text-gray-700
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
    backgroundColor: "#8B3DFF", // Main Purple
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
          color: "#00C4CC", // Brand Color
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

// ===================== Footer (통일된 밝은 테마) =====================
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

// ===================== ImageGenerator 컴포넌트 =====================
function ImageGenerator() {
  const navigate = useNavigate();

  const [selectedAdText, setSelectedAdText] = useState(null);
  const [textGenParams, setTextGenParams] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [originalBase64, setOriginalBase64] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [error, setError] = useState("");

  // Header에 전달할 onLogout 함수
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
        const base64String = reader.result.split(",")[1];
        setOriginalBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompose = async () => {
    try {
      setError("");
      setIsLoading(true);

      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";
      const token = localStorage.getItem("jwtToken");

      const caption =
        (selectedAdText && selectedAdText.trim()) ||
        (localStorage.getItem("selectedAdText") || "").trim() ||
        (localStorage.getItem("selectedText") || "").trim();

      if (!caption) {
        setError("문구(caption)가 비어 있어요. 먼저 문구를 선택해주세요.");
        return;
      }

      let fileToSend = imageFile;
      if (!fileToSend && originalBase64) {
        // base64 -> blob 변환 로직
        const toBlobFromDataUrl = (dataUrl) => {
          const [meta, b64] = dataUrl.split(",");
          const mime =
            (meta?.match(/data:(.*?);base64/) || [])[1] || "image/png";
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          return new Blob([u8], { type: mime });
        };
        const blob = toBlobFromDataUrl(
          `data:image/png;base64,${originalBase64}`
        );
        fileToSend = new File([blob], "upload.png", { type: blob.type });
      }

      if (!fileToSend) {
        setError("이미지를 먼저 선택해주세요.");
        return;
      }

      const product = localStorage.getItem("product") || "";

      const fd = new FormData();
      fd.append("caption", caption);
      fd.append("image", fileToSend);
      if (product) fd.append("product", product);
      const userEmail = localStorage.getItem("userEmail") || "";
      if (userEmail) fd.append("userEmail", userEmail);

      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await axios.post(`${apiUrl}/api/generate-image`, fd, {
        withCredentials: true,
        headers,
      });

      const b64 = res.data?.image_base64 || res.data?.imageBase64 || null;

      if (b64) {
        setResultUrl(`data:image/png;base64,${b64}`);
        return;
      }

      const id = res.data?.adContentId;
      if (id) {
        const getHeaders = {};
        if (token) getHeaders["Authorization"] = `Bearer ${token}`;
        const rec = await axios.get(`${apiUrl}/api/ad-content/${id}`, {
          headers: getHeaders,
          withCredentials: true,
        });
        const b64img = rec.data?.generatedImageBase64;
        if (b64img) {
          setResultUrl(`data:image/png;base64,${b64img}`);
        } else {
          setError("이미지가 저장되었지만 조회 응답에 이미지가 없습니다.");
        }
      } else {
        setError("이미지 생성은 성공했지만 식별자(adContentId)가 없습니다.");
      }
    } catch (err) {
      console.error("이미지 합성 오류:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "이미지 합성 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
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
      const errorMessage =
        error.response && error.response.status === 401
          ? "인증이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요."
          : error.response?.data?.message ||
            error.message ||
            "광고 콘텐츠 저장 중 예상치 못한 오류가 발생했습니다. 😥";
      alert(errorMessage);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("jwtToken");
        navigate("/auth/login");
      }
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
    backgroundColor: "#F9FAFB", // gray-50
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  const mainContentStyle = {
    flexGrow: 1,
    padding: "60px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  const titleStyle = {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "20px",
    textAlign: "center",
  };

  // 선택된 문구 박스 스타일 (깔끔한 그레이/블루 톤)
  const infoBoxStyle = {
    marginBottom: "24px",
    padding: "16px",
    backgroundColor: "#F3F4F6", // gray-100
    borderLeft: "4px solid #8B3DFF", // accent color
    borderRadius: "4px",
    color: "#374151", // gray-700
    fontSize: "0.95rem",
    textAlign: "left",
    lineHeight: "1.5",
  };

  const fileInputStyle = {
    marginBottom: "20px",
    padding: "10px",
    border: "1px dashed #D1D5DB", // gray-300
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#FAFAFA",
  };

  // 공통 버튼 스타일 생성 함수
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
        <div style={cardStyle}>
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
                옵션: {textGenParams.product} | {textGenParams.target} |{" "}
                {textGenParams.purpose}
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
            {isLoading ? "이미지 합성 중... ⏳" : "⚡ 이미지 합성하기"}
          </button>

          <button
            onClick={handleGoFacebook}
            disabled={isLoading || !resultUrl}
            style={getButtonStyle("#1877f2", isLoading || !resultUrl)} // Facebook Blue
          >
            FacebookInput으로 이동 ➡️
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

          {resultUrl && (
            <div
              style={{
                marginTop: "30px",
                borderTop: "1px solid #E5E7EB",
                paddingTop: "30px",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "1.2rem",
                  color: "#111827",
                  marginBottom: "15px",
                }}
              >
                ✨ 합성 결과
              </h3>
              <img
                src={resultUrl}
                alt="Composite Ad"
                style={{
                  maxWidth: "100%",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  marginBottom: "20px",
                }}
              />
              <button
                onClick={handleSaveContent}
                disabled={isSavingContent}
                style={getButtonStyle("#10B981", isSavingContent)} // Green
              >
                {isSavingContent ? "저장 중..." : "📂 광고 콘텐츠 저장"}
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ImageGenerator;
