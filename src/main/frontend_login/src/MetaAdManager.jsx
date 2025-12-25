import React from "react";
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

// ===================== MetaAdManager 컴포넌트 =====================
function MetaAdManager() {
  const navigate = useNavigate();

  const handleGoToMetaAds = () => {
    // 실제 메타 광고 관리자 URL
    const metaAdsUrl = "https://business.facebook.com/adsmanager/";
    window.open(metaAdsUrl, "_blank"); // 새 탭으로 열기
  };

  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  const onLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login");
  };

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
    justifyContent: "center", // 중앙 정렬
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "550px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "50px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  };

  const titleStyle = {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "20px",
  };

  const descriptionStyle = {
    fontSize: "1.05rem",
    color: "#4B5563", // gray-600
    lineHeight: "1.6",
    marginBottom: "40px",
    wordBreak: "keep-all", // 단어 단위 줄바꿈
  };

  const buttonStyle = {
    width: "100%",
    padding: "16px",
    backgroundColor: "#1877F2", // Facebook Blue
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "1.1rem",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 6px rgba(24, 119, 242, 0.2)",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  };

  const noteStyle = {
    fontSize: "0.85rem",
    color: "#9CA3AF", // gray-400
    marginTop: "20px",
  };

  // 아이콘 스타일 (간단한 SVG 예시)
  const metaIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13.06 16.12C12.92 16.12 12.78 16.08 12.66 16.02C12.38 15.86 12.2 15.58 12.2 15.26V13.84H10.74C10.08 13.84 9.54 13.3 9.54 12.64V11.36C9.54 10.7 10.08 10.16 10.74 10.16H12.2V8.74C12.2 8.42 12.38 8.14 12.66 7.98C12.94 7.82 13.28 7.82 13.56 7.98L16.2 9.54C16.48 9.7 16.66 9.98 16.66 10.3V13.7C16.66 14.02 16.48 14.3 16.2 14.46L13.56 16.02C13.4 16.1 13.22 16.12 13.06 16.12Z" />
    </svg>
  );

  return (
    <div style={pageContainerStyle}>
      {/* 헤더 */}
      <Header isLoggedIn={isLoggedIn} onLogout={onLogout} />

      {/* 메인 콘텐츠 영역 */}
      <main style={mainContentStyle}>
        <div style={cardStyle}>
          {/* 장식용 아이콘 (선택 사항) */}
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "10px",
            }}
          >
            📈
          </div>

          <h2 style={titleStyle}>메타 광고 관리</h2>

          <p style={descriptionStyle}>
            생성된 광고 캠페인을 관리하고
            <br />
            실시간 성과를 분석하고 싶으신가요?
            <br />
            아래 버튼을 눌러 메타 광고 관리자로 이동하세요.
          </p>

          <button
            onClick={handleGoToMetaAds}
            style={buttonStyle}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#166FE5")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#1877F2")
            }
          >
            {/* metaIcon */}
            메타 광고 관리자 바로가기
          </button>

          <p style={noteStyle}>(새 창으로 열립니다)</p>
        </div>
      </main>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}

export default MetaAdManager;
