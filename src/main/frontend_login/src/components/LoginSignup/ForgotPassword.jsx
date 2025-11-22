// src/components/LoginSignup/ForgotPassword.jsx (스타일만 변경된 코드)

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LoginSignup.css"; // LoginSignup.css와 공통 다크 테마 스타일 사용
import email_icon from "../Assets/email.png";
import password_icon from "../Assets/password.png";

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

export { Header, Footer };

const ForgotPassword = ({ onBackToLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email || !newPassword) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    const apiUrl = process.env.REACT_APP_API_URL;
    try {
      const response = await fetch(`${apiUrl}/api/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setSuccess(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {" "}
      {/* LoginSignup.css의 .container 스타일 적용 */}
      <div className="header">
        {" "}
        {/* LoginSignup.css의 .header 스타일 적용 */}
        <div className="text">Reset Password</div>{" "}
        {/* LoginSignup.css의 .text 스타일 적용 */}
        <div className="underline"></div>{" "}
        {/* LoginSignup.css의 .underline 스타일 적용 */}
      </div>
      {error && (
        <div
          className="error-message"
          style={{
            color: "#ff6b6b", // ✅ 에러 메시지 색상은 가시성을 위해 빨간색 계열 유지
            backgroundColor: "rgba(255, 107, 107, 0.2)", // ✅ 에러 배경을 좀 더 어둡고 투명하게
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      {!success ? (
        <>
          <div className="inputs">
            {" "}
            {/* LoginSignup.css의 .inputs 스타일 적용 */}
            <div className="input">
              {" "}
              {/* LoginSignup.css의 .input 스타일 적용 */}
              <img src={email_icon} alt="" />{" "}
              {/* LoginSignup.css의 .input img 스타일 적용 */}
              <input
                type="email"
                placeholder="Email Id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />{" "}
              {/* LoginSignup.css의 .input input 스타일 적용 */}
            </div>
            <div className="input">
              {" "}
              {/* LoginSignup.css의 .input 스타일 적용 */}
              <img src={password_icon} alt="" />{" "}
              {/* LoginSignup.css의 .input img 스타일 적용 */}
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />{" "}
              {/* LoginSignup.css의 .input input 스타일 적용 */}
            </div>
          </div>
          <div className="submit-container">
            {" "}
            {/* LoginSignup.css의 .submit-container 스타일 적용 */}
            <div
              className="submit" // LoginSignup.css의 .submit 스타일 적용
              onClick={handleReset}
              style={{
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Processing..." : "Reset Password"}
            </div>
          </div>
          <div className="submit-container">
            {" "}
            {/* LoginSignup.css의 .submit-container 스타일 적용 */}
            <div className="submit gray" onClick={onBackToLogin}>
              {" "}
              {/* LoginSignup.css의 .submit.gray 스타일 적용 */}
              Back to Login
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              color: "#A8E6CF", // ✅ 성공 메시지 색상을 밝은 그린 (포인트 컬러)로 변경
              fontWeight: 600,
              margin: "30px 0",
              textShadow: "0 0 10px rgba(168,230,207,0.3)", // ✅ 텍스트 그림자 추가
              textAlign: "center", // ✅ 중앙 정렬 추가
            }}
          >
            Password reset successful! Please log in with your new password.
          </div>
          <div className="submit-container">
            {" "}
            {/* LoginSignup.css의 .submit-container 스타일 적용 */}
            <div
              className="submit" // LoginSignup.css의 .submit 스타일 적용
              onClick={onBackToLogin}
              style={
                {
                  /* LoginSignup.css에서 적용된 opacity 및 cursor 스타일은 그대로 유지 */
                }
              }
            >
              Back to Login
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ForgotPassword;
