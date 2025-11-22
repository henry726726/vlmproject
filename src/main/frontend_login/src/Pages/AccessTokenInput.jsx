// src/Pages/AccessTokenInput.jsx

import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom"; // Link와 useNavigate 추가

// ===================== 스타일 객체 (Header/Footer에서 사용) =====================
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

// ===================== Header 컴포넌트 (AccessTokenInput.jsx 내부에 정의) =====================
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

// ===================== Footer 컴포넌트 (AccessTokenInput.jsx 내부에 정의) =====================
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

// ===================== AccessTokenInput 컴포넌트 =====================
function AccessTokenInput() {
  const navigate = useNavigate(); // useNavigate 추가
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("jwtToken");

      // eslint-disable-next-line no-unused-vars
      const response = await axios.post(
        // response는 사용되지 않으므로 ESLint 경고를 무시합니다.
        "http://localhost:8080/api/access-token",
        { accessToken },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("✅ 액세스토큰 저장 완료");
    } catch (err) {
      console.error(err);
      setMessage("❌ 저장 실패: " + (err.response?.data || err.message));
    }
  };

  // Header에 전달할 onLogout 함수 정의
  const handleHeaderLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login"); // navigate 사용
  };

  // 현재 로그인 상태 (Header 컴포넌트에 전달하기 위함)
  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* 헤더 */}
      <Header isLoggedIn={isLoggedIn} onLogout={handleHeaderLogout} />

      {/* 메인 콘텐츠 영역 (남은 공간을 차지하여 푸터를 아래로 밀어냄) */}
      <main style={{ flexGrow: 1 }}>
        <div
          style={{
            padding: "30px",
            maxWidth: "500px",
            margin: "0 auto",
            fontFamily: "'Noto Sans KR', sans-serif",
            color: "#333",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "20px",
              color: "#ffffffff",
            }}
          >
            🔑 액세스토큰 입력
          </h2>
          <input
            type="text"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Meta 엑세스토큰을 입력하세요"
            style={{
              width: "95%",
              padding: "12px",
              marginBottom: "15px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              width: "100%",
              padding: "12px 20px",
              backgroundColor: "#6243a5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              cursor: "pointer",
              transition: "background-color 0.3s ease",
            }}
          >
            저장
          </button>
          {message && (
            <p
              style={{
                marginTop: "15px",
                textAlign: "center",
                color: message.startsWith("✅") ? "#4CAF50" : "#ff6347",
              }}
            >
              {message}
            </p>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}

export default AccessTokenInput;
