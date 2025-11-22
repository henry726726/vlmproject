// src/MetaAdManager.jsx

import React from "react";
import { useNavigate, Link } from "react-router-dom";

// 네비게이션 링크 스타일
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

// 로그아웃 버튼 스타일
const logoutButtonStyle = {
  color: "#fff",
  backgroundColor: "#ff6536",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontWeight: "600",
  cursor: "pointer",
};

// 헤더 컴포넌트
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

// 푸터 컴포넌트
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

// 메인 컴포넌트
function MetaAdManager() {
  const navigate = useNavigate();

  const handleGoToMetaAds = () => {
    // 실제 메타 광고 관리자 URL로 변경해야 함
    const metaAdsUrl = "https://business.facebook.com/adsmanager/";
    window.open(metaAdsUrl, "_blank"); // 새 탭으로 열기
  };

  // 로그인 여부 (다른 인증 로직에 맞게 변경 가능)
  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  // 로그아웃 함수
  const onLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login");
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* 헤더 */}
      <Header isLoggedIn={isLoggedIn} onLogout={onLogout} />

      {/* 메인 콘텐츠 영역 */}
      <main
        style={{
          maxWidth: 600,
          margin: "40px auto",
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 8,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          backgroundColor: "#2b2452",
          flexGrow: 1, // 푸터를 아래 고정하는 역할
          textAlign: "center",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        <h2 style={{ color: "#ffffffff", marginBottom: 25 }}>
          📈 메타 광고 관리
        </h2>

        <p style={{ fontSize: "1.1em", color: "#ffffffff", lineHeight: 1.6 }}>
          여기에서 메타(페이스북/인스타그램) 광고 캠페인을 관리하고 성과를
          확인하실 수 있습니다. 아래 버튼을 클릭하여 메타 광고 관리자 페이지로
          이동하세요.
        </p>

        <button
          onClick={handleGoToMetaAds}
          style={{
            marginTop: 30,
            padding: "15px 30px",
            backgroundColor: "#3b5998",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: "1.2em",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background-color 0.3s ease",
          }}
        >
          메타 광고 관리자 페이지로 이동 ➡️
        </button>

        <p style={{ fontSize: "0.8em", color: "#ffffff", marginTop: 20 }}>
          (새 창으로 열립니다.)
        </p>
      </main>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}

export default MetaAdManager;
