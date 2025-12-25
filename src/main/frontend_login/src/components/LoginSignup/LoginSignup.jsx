// src/components/LoginSignup/LoginSignup.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import user_icon from "../Assets/person.png";
import email_icon from "../Assets/email.png";
import password_icon from "../Assets/password.png";
import ForgotPassword from "./ForgotPassword";

// Header: LandingPage와 동일한 스타일 (흰색 배경 + 보라색 포인트)
function Header({ isLoggedIn, onLogout }) {
  return (
    <header
      style={{
        backgroundColor: "#ffffff",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #f3f4f6", // border-gray-100
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
          fontSize: "1.5rem", // text-3xl
          color: "#00C4CC", // Canva Logo Color
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

// Nav Link: 짙은 회색 텍스트 + 호버 효과
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

// Logout Button: 메인 퍼플 컬러 적용
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

// Footer: LandingPage와 동일한 심플한 스타일
function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#ffffff",
        borderTop: "1px solid #f3f4f6",
        color: "#6b7280", // text-gray-500
        fontSize: "0.875rem", // text-sm
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

const LoginSignup = ({ onLogin }) => {
  const navigate = useNavigate();
  const [action, setAction] = useState("Sign Up");
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
  });
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";
      const endpoint = action === "Login" ? "/auth/login" : "/auth/signup";

      const requestData =
        action === "Login"
          ? { email: formData.email, password: formData.password }
          : {
              nickname: formData.nickname,
              email: formData.email,
              password: formData.password,
            };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (action === "Login") {
        const token = data.token;
        if (token) {
          localStorage.setItem("jwtToken", token);
          onLogin && onLogin({ email: formData.email });
          alert("로그인 성공! 환영합니다!");
          navigate("/");
        } else {
          throw new Error("로그인에 실패했습니다. 토큰을 받지 못했습니다.");
        }
      } else {
        alert("회원가입 성공! 로그인 해주세요.");
        setAction("Login");
        setFormData({ nickname: "", email: "", password: "" });
        navigate("/auth/login");
      }
    } catch (err) {
      const errorMessage = err.message || "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotPassword onBackToLogin={() => setShowForgot(false)} />;
  }

  // ================= 스타일 정의 (LandingPage 테마 적용) =================

  // 전체 배경: 랜딩 페이지 Hero 섹션과 동일한 연한 라벤더색
  const pageBackgroundStyle = {
    backgroundColor: "#F2F0FF",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  // 카드 컨테이너: 흰색 배경 + 그림자 + 둥근 모서리
  const containerStyle = {
    maxWidth: "500px",
    width: "90%",
    margin: "60px auto",
    padding: "40px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", // Soft Shadow
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const headerTextStyle = {
    color: "#0E101A", // Dark Navy/Black
    fontSize: "2rem",
    fontWeight: "800",
    marginBottom: "10px",
    letterSpacing: "-0.025em",
  };

  // 언더라인: 메인 퍼플 컬러
  const underlineStyle = {
    width: "60px",
    height: "6px",
    backgroundColor: "#8B3DFF", // Main Purple
    borderRadius: "9px",
    marginBottom: "40px",
  };

  // 인풋 래퍼: 연한 회색 배경
  const inputWrapperStyle = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: "60px",
    backgroundColor: "#F9FAFB", // gray-50
    borderRadius: "8px",
    border: "1px solid #E5E7EB", // gray-200
    marginBottom: "16px",
    paddingLeft: "16px",
    transition: "border-color 0.2s",
  };

  // 아이콘: 기본적으로 너무 어둡지 않게 투명도 조절
  const iconStyle = {
    marginRight: "16px",
    width: "20px",
    height: "20px",
    opacity: 0.5,
  };

  const inputStyle = {
    flex: 1,
    height: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "#374151", // text-gray-700
    fontSize: "16px",
    fontWeight: "500",
  };

  const errorStyle = {
    backgroundColor: "#FEE2E2", // red-100
    color: "#EF4444", // red-500
    padding: "12px",
    borderRadius: "8px",
    width: "100%",
    marginBottom: "20px",
    fontSize: "14px",
    textAlign: "center",
    fontWeight: "600",
  };

  const forgotPasswordStyle = {
    width: "100%",
    textAlign: "left",
    color: "#6B7280", // gray-500
    fontSize: "14px",
    marginTop: "10px",
    marginBottom: "30px",
  };

  const clickHereStyle = {
    color: "#8B3DFF", // Main Purple
    fontWeight: "600",
    cursor: "pointer",
    marginLeft: "5px",
  };

  const submitContainerStyle = {
    display: "flex",
    gap: "16px",
    width: "100%",
    marginTop: "10px",
  };

  // 버튼 기본 스타일
  const baseButtonStyle = {
    flex: 1,
    height: "56px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "all 0.3s ease",
    border: "none",
  };

  // 활성 버튼 (보라색)
  const activeButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: "#8B3DFF", // Main Purple
    color: "#ffffff",
    boxShadow: "0 4px 6px -1px rgba(139, 61, 255, 0.3)",
    transform: "translateY(-1px)",
  };

  // 비활성 버튼 (회색)
  const inactiveButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: "#F3F4F6", // gray-100
    color: "#6B7280", // gray-500
  };

  return (
    <div style={pageBackgroundStyle}>
      <Header
        isLoggedIn={Boolean(localStorage.getItem("jwtToken"))}
        onLogout={() => {
          localStorage.removeItem("jwtToken");
          navigate("/auth/login");
        }}
      />

      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div style={headerTextStyle}>{action}</div>
          <div style={underlineStyle}></div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {action !== "Login" && (
          <div style={inputWrapperStyle}>
            <img src={user_icon} alt="User icon" style={iconStyle} />
            <input
              type="text"
              placeholder="Nickname"
              value={formData.nickname}
              onChange={(e) => handleInputChange("nickname", e.target.value)}
              disabled={loading}
              required
              style={inputStyle}
            />
          </div>
        )}

        <div style={inputWrapperStyle}>
          <img src={email_icon} alt="Email icon" style={iconStyle} />
          <input
            type="email"
            placeholder="Email Id"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            disabled={loading}
            required
            style={inputStyle}
          />
        </div>

        <div style={inputWrapperStyle}>
          <img src={password_icon} alt="Password icon" style={iconStyle} />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            disabled={loading}
            required
            style={inputStyle}
          />
        </div>

        {action === "Login" && (
          <div style={forgotPasswordStyle}>
            Lost Password?
            <span onClick={() => setShowForgot(true)} style={clickHereStyle}>
              Click here!
            </span>
          </div>
        )}

        <div style={submitContainerStyle}>
          {/* Sign Up Button */}
          <button
            style={
              action === "Sign Up" ? activeButtonStyle : inactiveButtonStyle
            }
            onClick={() => {
              if (action === "Sign Up") {
                handleSubmit();
              } else {
                setAction("Sign Up");
                setError("");
              }
            }}
          >
            {loading && action === "Sign Up" ? "Processing..." : "Sign Up"}
          </button>

          {/* Login Button */}
          <button
            style={action === "Login" ? activeButtonStyle : inactiveButtonStyle}
            onClick={() => {
              if (action === "Login") {
                handleSubmit();
              } else {
                setAction("Login");
                setError("");
              }
            }}
          >
            {loading && action === "Login" ? "Processing..." : "Login"}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LoginSignup;
