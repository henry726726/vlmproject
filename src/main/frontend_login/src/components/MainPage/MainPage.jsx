// src/components/MainPage/MainPage.jsx

import React from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Sparkles, // 광고 생성용 메인 아이콘
  LayoutDashboard,
  Key,
  Save,
  RefreshCw,
} from "lucide-react";

// ===================== Header (밝은 테마) =====================
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

// ===================== Footer (밝은 테마) =====================
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
      }}
    >
      <p style={{ marginBottom: "8px" }}>
        © 2025 AI Ad Manager. All rights reserved.
      </p>
      <p>대표: 장민서 | 대표 메일: msj3767@gmail.com</p>
    </footer>
  );
}

// ===================== MainPage 컴포넌트 =====================
function MainPage({ userData, onLogout, isLoggedIn }) {
  const navigate = useNavigate();

  const handleMenuClick = (path) => {
    if (!isLoggedIn) {
      navigate("/auth/login");
      return;
    }
    navigate(path);
  };

  // 1. 통합된 메인 기능 (가장 강조됨)
  const createAdMenu = {
    title: "광고 생성하기",
    desc: "AI가 문구 생성부터 이미지 합성, 배포 설정까지 한 번에 진행합니다.",
    path: "/text-generator", // 문구 생성 페이지로 시작
    icon: <Sparkles size={32} />,
    color: "text-white",
    bgColor: "bg-[#8B3DFF]", // 메인 퍼플 배경
  };

  // 2. 나머지 관리 기능들
  const managementMenus = [
    {
      title: "메타 관리",
      desc: "집행 중인 광고의 성과를 관리합니다.",
      path: "/meta-ad-manager",
      icon: <LayoutDashboard size={24} />,
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
    {
      title: "액세스토큰 저장",
      desc: "Meta API 연동 토큰을 관리합니다.",
      path: "/save-access-token",
      icon: <Key size={24} />,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "광고 계정 저장",
      desc: "사용할 광고 계정을 등록합니다.",
      path: "/save-ad-accounts",
      icon: <Save size={24} />,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "광고 동기화",
      desc: "최신 데이터를 서버와 동기화합니다.",
      path: "/sync-ad-info",
      icon: <RefreshCw size={24} />,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F9FAFB",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <Header userData={userData} onLogout={onLogout} isLoggedIn={isLoggedIn} />

      <main
        style={{
          flex: 1,
          maxWidth: "1000px",
          width: "100%",
          margin: "0 auto",
          padding: "40px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 환영 메시지 */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "2.2rem",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "10px",
            }}
          >
            환영합니다,{" "}
            <span style={{ color: "#8B3DFF" }}>
              {userData?.nickname || "사용자"}
            </span>
            님! 👋
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#6B7280" }}>
            AI와 함께 쉽고 빠르게 광고를 만들어보세요.
          </p>
        </div>

        {/* 1. [메인] 광고 생성하기 버튼 (크고 강조됨) */}
        <div
          onClick={() => handleMenuClick(createAdMenu.path)}
          style={{
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            padding: "32px",
            boxShadow:
              "0 10px 25px -5px rgba(139, 61, 255, 0.15), 0 4px 10px -5px rgba(0, 0, 0, 0.05)",
            border: "2px solid #8B3DFF", // 보라색 테두리로 강조
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "40px", // 구분선과의 간격
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow =
              "0 15px 30px -5px rgba(139, 61, 255, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "0 10px 25px -5px rgba(139, 61, 255, 0.15)";
          }}
        >
          {/* 아이콘 박스 */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "16px",
              backgroundColor: "#8B3DFF",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              flexShrink: 0,
            }}
          >
            {createAdMenu.icon}
          </div>
          {/* 텍스트 영역 */}
          <div>
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "800",
                color: "#1F2937",
                marginBottom: "8px",
              }}
            >
              {createAdMenu.title}
            </h3>
            <p style={{ fontSize: "1.05rem", color: "#4B5563" }}>
              {createAdMenu.desc}
            </p>
          </div>
        </div>

        {/* 2. 구분선 (Divider) */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
            color: "#9CA3AF",
          }}
        >
          <div
            style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}
          ></div>
          <span
            style={{
              padding: "0 16px",
              fontSize: "0.9rem",
              fontWeight: "500",
              letterSpacing: "1px",
            }}
          >
            관리 및 설정
          </span>
          <div
            style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}
          ></div>
        </div>

        {/* 3. [서브] 관리 메뉴 그리드 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            width: "100%",
          }}
        >
          {managementMenus.map((item, index) => (
            <div
              key={index}
              onClick={() => handleMenuClick(item.path)}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.boxShadow =
                  "0 8px 12px -3px rgba(0, 0, 0, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    // 개별 배경색 적용
                    backgroundColor: item.bgColor.includes("pink")
                      ? "#FCE7F3"
                      : item.bgColor.includes("amber")
                      ? "#FEF3C7"
                      : item.bgColor.includes("emerald")
                      ? "#D1FAE5"
                      : "#CFFAFE",
                    // 개별 아이콘색 적용
                    color: item.color.includes("pink")
                      ? "#DB2777"
                      : item.color.includes("amber")
                      ? "#D97706"
                      : item.color.includes("emerald")
                      ? "#059669"
                      : "#0891B2",
                  }}
                >
                  {item.icon}
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "700",
                    color: "#374151",
                  }}
                >
                  {item.title}
                </h3>
              </div>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#6B7280",
                  lineHeight: "1.4",
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default MainPage;
