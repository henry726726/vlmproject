// src/Pages/AccessTokenInput.jsx

import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

// ===================== Header (밝은 테마 적용) =====================
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

// ===================== Footer (밝은 테마 적용) =====================
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

// ===================== AccessTokenInput 컴포넌트 =====================
function AccessTokenInput() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false); // 로딩 상태 추가

  const handleSubmit = async () => {
    if (!accessToken.trim()) {
      setMessage("⚠️ 토큰을 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage(""); // 기존 메시지 초기화

    try {
      const token = localStorage.getItem("jwtToken");

      // eslint-disable-next-line no-unused-vars
      const response = await axios.post(
        "http://localhost:8080/api/access-token",
        { accessToken },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("✅ 액세스토큰이 성공적으로 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setMessage("❌ 저장 실패: " + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Header에 전달할 onLogout 함수
  const handleHeaderLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login");
  };

  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  // ================= 스타일 객체 (MyPage와 통일) =================
  const pageContainerStyle = {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: "#F9FAFB", // 전체 배경색 (밝은 회색)
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  const mainContentStyle = {
    flexGrow: 1,
    padding: "60px 20px", // 상하 여백 넉넉하게
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center", // 중앙 정렬
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "520px", // 카드 너비
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const titleStyle = {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "#111827", // 진한 회색 (제목)
    marginBottom: "10px",
  };

  const subTextStyle = {
    fontSize: "0.95rem",
    color: "#6B7280", // 연한 회색 (설명)
    marginBottom: "30px",
    textAlign: "center",
  };

  const inputStyle = {
    width: "100%",
    padding: "14px",
    marginBottom: "20px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    fontSize: "1rem",
    backgroundColor: "#F9FAFB",
    outline: "none",
    boxSizing: "border-box", // 패딩 포함 크기 계산
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    backgroundColor: loading ? "#E5E7EB" : "#8B3DFF", // 로딩 시 회색, 평소 보라색
    color: loading ? "#9CA3AF" : "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "700",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "background-color 0.2s ease",
  };

  return (
    <div style={pageContainerStyle}>
      {/* 헤더 */}
      <Header isLoggedIn={isLoggedIn} onLogout={handleHeaderLogout} />

      {/* 메인 콘텐츠 영역 */}
      <main style={mainContentStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>액세스토큰 설정</div>
          <p style={subTextStyle}>
            Meta 광고 계정을 연동하기 위해
            <br />
            발급받은 액세스토큰을 입력해주세요.
          </p>

          <input
            type="text"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Meta Access Token 입력"
            style={inputStyle}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={buttonStyle}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = "#7C3AED";
            }}
            onMouseOut={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = "#8B3DFF";
            }}
          >
            {loading ? "저장 중..." : "토큰 저장하기"}
          </button>

          {message && (
            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                borderRadius: "8px",
                width: "100%",
                textAlign: "center",
                fontSize: "0.95rem",
                fontWeight: "500",
                backgroundColor: message.startsWith("✅")
                  ? "#ECFDF5" // 성공 시 연한 초록 배경
                  : "#FEF2F2", // 실패 시 연한 빨강 배경
                color: message.startsWith("✅") ? "#059669" : "#DC2626",
                boxSizing: "border-box",
              }}
            >
              {message}
            </div>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}

export default AccessTokenInput;
