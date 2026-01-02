// src/components/Auth/Login.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import ForgotPassword from "../LoginSignup/ForgotPassword"; // 기존 경로 유지 혹은 위치 변경

// (Signup.jsx와 동일한 Header/Footer를 사용합니다. 실제로는 별도 파일로 분리하여 import하는 것이 좋습니다.)
function Header() {
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
      <nav>
        {/* 로그인 페이지이므로 회원가입 버튼 노출 */}
        <Link
          to="/auth/signup"
          style={{
            color: "#374151",
            textDecoration: "none",
            fontWeight: "500",
          }}
        >
          회원가입
        </Link>
      </nav>
    </header>
  );
}

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

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "", // 백엔드 설정에 따라 loginId로 변경 가능
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault(); // Form submit 방지
    setLoading(true);
    setError("");

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // 토큰 저장
        localStorage.setItem("jwtToken", data.token);

        // 상위 컴포넌트(App.js 등)에 로그인 상태 업데이트 알림
        if (onLogin) {
          onLogin({ email: formData.email });
        }

        // 메인 페이지로 이동
        navigate("/");
      } else {
        throw new Error(data.message || "이메일 또는 비밀번호를 확인해주세요.");
      }
    } catch (err) {
      setError(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotPassword onBackToLogin={() => setShowForgot(false)} />;
  }

  /* ================== Styles (Signup과 통일) ================== */
  const pageBackgroundStyle = {
    backgroundColor: "#F2F0FF", // 통일된 배경색
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  const containerStyle = {
    maxWidth: "450px", // 로그인 창은 회원가입보다 조금 좁게
    width: "90%",
    margin: "80px auto", // 상단 여백
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const titleStyle = {
    fontSize: "1.8rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "10px",
    textAlign: "center",
  };

  const subtitleStyle = {
    fontSize: "1rem",
    color: "#6B7280",
    marginBottom: "40px",
    textAlign: "center",
  };

  const inputStyle = {
    width: "100%",
    height: "50px",
    padding: "0 16px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    backgroundColor: "#F9FAFB",
    fontSize: "15px",
    marginBottom: "16px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const buttonStyle = {
    width: "100%",
    height: "56px",
    backgroundColor: "#8B3DFF", // 메인 컬러
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "20px",
    boxShadow: "0 4px 6px -1px rgba(139, 61, 255, 0.2)",
    transition: "transform 0.1s ease",
  };

  const linkContainerStyle = {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    marginTop: "16px",
    fontSize: "14px",
    color: "#6B7280",
  };

  const linkStyle = {
    color: "#8B3DFF",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <div style={pageBackgroundStyle}>
      <Header />

      <div style={containerStyle}>
        <h2 style={titleStyle}>로그인</h2>
        <p style={subtitleStyle}>서비스 이용을 위해 로그인해주세요</p>

        {error && (
          <div
            style={{
              width: "100%",
              backgroundColor: "#FEE2E2",
              color: "#EF4444",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          {/* 이메일 입력 */}
          <input
            type="email"
            placeholder="이메일"
            style={inputStyle}
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            required
          />

          {/* 비밀번호 입력 */}
          <input
            type="password"
            placeholder="비밀번호"
            style={inputStyle}
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            required
          />

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div style={linkContainerStyle}>
          <span
            onClick={() => setShowForgot(true)}
            style={{ cursor: "pointer", color: "#6B7280" }}
          >
            비밀번호를 잊으셨나요?
          </span>
          <Link to="/auth/signup" style={linkStyle}>
            회원가입
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Login;
