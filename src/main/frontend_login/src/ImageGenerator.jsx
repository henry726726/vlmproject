// src/ImageGenerator.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom"; // Link는 Header/Footer에서 사용

const navLinkStyle = {
  color: "#a8a5f1",
  fontWeight: "600",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 6,
  backgroundColor: "rgba(255,255,255,0.1)",
  transition: "background-color 0.3s ease",
  cursor: "pointer",
};

const logoutButtonStyle = {
  color: "#fff",
  backgroundColor: "#ff6536",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontWeight: "600",
  cursor: "pointer",
};

function Header({ isLoggedIn, onLogout }) {
  return (
    <header
      style={{
        backgroundColor: "#3a2a60",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#a8a5f1",
        fontFamily: "'Noto Sans KR', sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}
    >
      <Link
        to="/"
        style={{
          fontWeight: "700",
          fontSize: "1.5rem",
          color: "#A8E6CF",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        Ad Manager
      </Link>

      <nav style={{ display: "flex", gap: 12 }}>
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

function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#6243a5",
        color: "#cfcce2",
        fontSize: "0.9rem",
        padding: "15px 0",
        textAlign: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
        boxShadow: "inset 0 1px 4px rgba(255,255,255,0.15)",
        marginTop: "auto",
      }}
    >
      <p>© 2025 광고 매니저. All rights reserved.</p>
      <p>연락처: support@admanager.com</p>
    </footer>
  );
}

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

  // 'mode'와 'setMode'는 사용되지 않으므로 제거합니다.

  // Header에 전달할 onLogout 함수 정의
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
  }, [navigate]); // navigate가 의존성 배열에 있어야 eslint 경고 해결

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
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        문구 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {" "}
      {/* 전체 컨테이너를 flex column으로 만들고 최소 높이 100vh */}
      {/* Header 컴포넌트 렌더링 */}
      <Header
        isLoggedIn={Boolean(localStorage.getItem("jwtToken"))}
        onLogout={handleHeaderLogout}
      />
      <div
        style={{
          flexGrow: 1, // 남은 공간을 차지하여 Footer를 하단으로 밀어냄
          maxWidth: 600,
          margin: "40px auto",
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          backgroundColor: "#2b2452",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
          boxSizing: "border-box", // 패딩이 너비에 포함되도록
        }}
      >
        <h2 style={{ marginBottom: 20, color: "#ffffffff" }}>
          {" "}
          광고 이미지 합성기
        </h2>

        <div
          style={{
            marginBottom: 15,
            padding: 10,
            border: "1px dashed #007bff",
            borderRadius: 5,
            backgroundColor: "#d0bbff" /* 이전 #d0bbffff */,
            color: "#000000",
          }}
        >
          <strong>선택된 문구:</strong>{" "}
          {selectedAdText || "문구 생성기에서 문구를 선택해주세요. ⚠️"}
          {textGenParams && (
            <div style={{ fontSize: "0.8em", color: "#666", marginTop: "5px" }}>
              ({textGenParams.product || "없음"} |{" "}
              {textGenParams.target || "없음"} |{" "}
              {textGenParams.purpose || "없음"})
              {textGenParams.keyword && ` | ${textGenParams.keyword}`}
              {textGenParams.duration && ` | ${textGenParams.duration}`}
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ marginBottom: 15 }}
        />

        {originalBase64 && (
          <div style={{ marginBottom: 15 }}>
            <img
              src={`data:image/png;base64,${originalBase64}`}
              alt="Uploaded"
              style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: 8 }}
            />
          </div>
        )}

        <button
          onClick={handleCompose}
          disabled={isLoading || !selectedAdText}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: isLoading || !selectedAdText ? "#999" : "#ac2eff",
            color: "white",
            border: "none",
            borderRadius: 5,
            fontSize: "1.1em",
            cursor: "pointer",
            marginBottom: 10,
            opacity: isLoading || !selectedAdText ? 0.7 : 1,
          }}
        >
          {isLoading ? "이미지 합성 중... ⏳" : "이미지 합성하기 "}
        </button>

        {/* ⬇️ 여기 추가: 합성이 끝나야(=resultUrl 존재) 활성화 */}
        <button
          onClick={handleGoFacebook}
          disabled={isLoading || !resultUrl}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: isLoading || !resultUrl ? "#999" : "#1877f2",
            color: "white",
            border: "none",
            borderRadius: 5,
            fontSize: "1.05em",
            cursor: isLoading || !resultUrl ? "not-allowed" : "pointer",
            marginBottom: 10,
            opacity: isLoading || !resultUrl ? 0.7 : 1,
          }}
        >
          FacebookInput으로 이동 ➡️
        </button>

        {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

        {resultUrl && (
          <div
            style={{
              marginTop: 20,
              borderTop: "1px solid #eee",
              paddingTop: 20,
            }}
          >
            <h3>합성된 이미지 👇</h3>
            <img
              src={resultUrl}
              alt="Composite Ad"
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            />
            <button
              onClick={handleSaveContent}
              disabled={isSavingContent}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 15,
                backgroundColor: isSavingContent ? "#999" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: 5,
                fontSize: "1.1em",
                cursor: "pointer",
                opacity: isSavingContent ? 0.7 : 1,
              }}
            >
              {isSavingContent ? "콘텐츠 저장 중... " : "광고 콘텐츠 저장 ✅"}
            </button>
          </div>
        )}
      </div>
      {/* Footer 컴포넌트 렌더링 */}
      <Footer />
    </div>
  );
}

export default ImageGenerator;
