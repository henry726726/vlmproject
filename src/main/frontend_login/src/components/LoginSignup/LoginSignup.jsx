// src/components/LoginSignup/LoginSignup.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import user_icon from "../Assets/person.png";
import email_icon from "../Assets/email.png";
import password_icon from "../Assets/password.png";
import ForgotPassword from "./ForgotPassword";

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

  // 스타일 인라인 객체 (스크린샷 스타일 기준)

  const containerStyle = {
    maxWidth: 570,
    minHeight: 530,
    margin: "70px auto",
    padding: 30,
    background: "linear-gradient(135deg, #250b5d 0%, #3a1d6e 100%)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
    fontFamily: "'Noto Sans KR', sans-serif",
    color: "#d0d7ff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-evenly", // 인풋과 버튼 영역이 박스 내부 세로 공간에 균등 분포됨
    alignItems: "center",
  };

  const headerTextStyle = {
    color: "#A8E6CF",
    fontSize: "2em",
    fontWeight: 600,
    textShadow: "0 0 15px rgba(168,230,207,0.5)",
    marginBottom: 10,
  };

  const underlineStyle = {
    width: 60,
    height: 5,
    background: "linear-gradient(90deg, #6aa78e, #8cbfbd)",
    borderRadius: 9,
    marginBottom: 30,
  };

  const inputWrapperStyle = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 80,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    border: "1px solid rgba(255,255,255,0.3)",
    marginBottom: 15,
    paddingLeft: 12,
  };

  const iconStyle = {
    marginRight: 15,
    filter: "brightness(1) invert(0.8)",
    opacity: 0.9,
    width: 24,
    height: 24,
  };

  const inputStyle = {
    flex: 1,
    height: "60%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#e0e0ff",
    fontSize: 16,
  };

  const errorStyle = {
    backgroundColor: "rgba(255,107,107,0.2)",
    color: "#ff6b6b",
    padding: 10,
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "bold",
  };

  const forgotPasswordStyle = {
    width: "100%",
    textAlign: "left",
    color: "#b7b4d6",
    fontSize: 15,
    marginTop: 10,
    marginBottom: 20,
  };

  const clickHereStyle = {
    color: "#6aa78e",
    fontWeight: 600,
    cursor: "pointer",
    marginLeft: 5,
  };

  const submitContainerStyle = {
    display: "flex",
    gap: 20,
    width: "100%",
    marginTop: 20,
  };

  const submitButtonStyle = {
    flex: 1,
    height: 70,
    borderRadius: 30,
    fontWeight: 700,
    fontSize: 17,
    cursor: "pointer",
    color: "#fff",
    background: "linear-gradient(45deg, #6aa78e, #8cbfbd)",
    boxShadow: "0 6px 12px rgba(0,0,0,0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "all 0.3s ease",
  };

  const submitButtonGrayStyle = {
    ...submitButtonStyle,
    background: "linear-gradient(45deg, #7b7e8d, #6c6f7e)",
    color: "#d1d4de",
  };

  return (
    <>
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
              {" "}
              Click here!
            </span>
          </div>
        )}

        <div style={submitContainerStyle}>
          <div
            className={action === "Login" ? "submit gray" : "submit"}
            style={{
              ...submitButtonStyle,
              ...(action === "Login" ? submitButtonGrayStyle : {}),
            }}
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
          </div>
          <div
            className={action === "Sign Up" ? "submit gray" : "submit"}
            style={{
              ...submitButtonStyle,
              ...(action === "Sign Up" ? submitButtonGrayStyle : {}),
            }}
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
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default LoginSignup;
