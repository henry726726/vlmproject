import React, { useState } from "react";
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

// ===================== TextGenerator 컴포넌트 =====================
function TextGenerator() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    product: "",
    target: "",
    purpose: "",
    keyword: "",
    duration: "",
  });
  const [adTexts, setAdTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prevForm) => ({ ...prevForm, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAdTexts([]);
    setError("");

    const formValues = Object.values(form);
    const isValid = formValues.every((value) => value.trim() !== "");
    if (!isValid) {
      setError("모든 필드를 입력해주세요! 😅");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("jwtToken");
    if (!token) {
      setError("로그인이 필요합니다. 다시 로그인해주세요!");
      navigate("/auth/login");
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";
      const res = await axios.post(`${apiUrl}/api/generate`, form, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setAdTexts(res.data.adTexts || []);
    } catch (err) {
      console.error("❌ 광고 문구 생성 오류:", err);
      const errorMessage =
        err.response && err.response.status === 401
          ? "인증이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요."
          : err.response?.data?.message ||
            err.message ||
            "광고 문구 생성 중 오류가 발생했습니다. 백엔드 서버를 확인해주세요.";
      setError(errorMessage);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("jwtToken");
        navigate("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectText = (chosenText) => {
    if (!chosenText) {
      setError("선택할 문구가 없습니다.");
      return;
    }
    localStorage.setItem("selectedText", chosenText);
    localStorage.setItem("selectedAdText", chosenText);
    localStorage.setItem("Product", form.product || "");
    localStorage.setItem("textGenParams", JSON.stringify(form));
    navigate("/image-generator");
  };

  // ================= 스타일 객체 (MyPage와 통일) =================
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
    maxWidth: "600px", // 입력 폼이 많으므로 약간 넓게
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
  };

  const titleStyle = {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "10px",
    textAlign: "center",
  };

  const subTextStyle = {
    fontSize: "0.95rem",
    color: "#6B7280",
    marginBottom: "30px",
    textAlign: "center",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "6px",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    marginBottom: "16px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    backgroundColor: "#F9FAFB",
    color: "#1F2937",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    backgroundColor: loading ? "#E5E7EB" : "#8B3DFF",
    color: loading ? "#9CA3AF" : "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.1rem",
    fontWeight: "700",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "background-color 0.2s ease",
    marginTop: "10px",
  };

  // 결과 버튼 스타일
  const resultButtonStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "12px",
    backgroundColor: "#F3F4F6", // gray-100
    fontSize: "1rem",
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.2s ease",
    lineHeight: "1.5",
  };

  return (
    <div style={pageContainerStyle}>
      <Header
        isLoggedIn={Boolean(localStorage.getItem("jwtToken"))}
        onLogout={() => {
          localStorage.removeItem("jwtToken");
          navigate("/auth/login");
        }}
      />

      <main style={mainContentStyle}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>광고 문구 생성기</h2>
          <p style={subTextStyle}>
            AI가 제품에 딱 맞는 매력적인 광고 문구를 만들어드립니다.
          </p>

          <form onSubmit={handleSubmit}>
            <div>
              <label style={labelStyle}>제품명</label>
              <input
                name="product"
                value={form.product}
                onChange={handleChange}
                placeholder="예: 럭셔리 시계"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>타겟 고객</label>
              <input
                name="target"
                value={form.target}
                onChange={handleChange}
                placeholder="예: 30대 남성 직장인"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>광고 목적</label>
              <input
                name="purpose"
                value={form.purpose}
                onChange={handleChange}
                placeholder="예: 구매 유도, 브랜드 인지도 향상"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>강조 키워드</label>
              <input
                name="keyword"
                value={form.keyword}
                onChange={handleChange}
                placeholder="예: 프리미엄, 한정판"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>광고 기간</label>
              <input
                name="duration"
                value={form.duration}
                onChange={handleChange}
                placeholder="예: 5일, 1개월"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={buttonStyle}
              onMouseOver={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#7C3AED";
              }}
              onMouseOut={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#8B3DFF";
              }}
            >
              {loading ? "AI 생성 중..." : "✨ 문구 생성하기"}
            </button>
          </form>

          {/* 에러 메시지 */}
          {error && (
            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              {error}
            </div>
          )}

          {/* 결과 표시 영역 */}
          {adTexts.length > 0 && (
            <div
              style={{
                marginTop: "40px",
                borderTop: "1px solid #F3F4F6",
                paddingTop: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  color: "#111827",
                  marginBottom: "15px",
                  textAlign: "center",
                }}
              >
                👇 마음에 드는 문구를 선택하세요
              </h3>
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  paddingRight: "5px", // 스크롤바 공간
                }}
              >
                {adTexts.map((text, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectText(text)}
                    style={resultButtonStyle}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "#E5E7EB";
                      e.currentTarget.style.borderColor = "#8B3DFF";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "#F3F4F6";
                      e.currentTarget.style.borderColor = "#E5E7EB";
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default TextGenerator;
