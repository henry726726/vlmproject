// src/components/LoginSignup/Signup.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

/* ================== Header & Footer (스타일 통일) ================== */
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
        <Link
          to="/auth/login"
          style={{
            color: "#374151",
            textDecoration: "none",
            fontWeight: "500",
          }}
        >
          로그인
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

/* ================== Main Signup Component ================== */
const Signup = () => {
  const navigate = useNavigate();

  // 단계 관리 (1: 약관동의, 2: 정보입력)
  const [step, setStep] = useState(1);

  // 약관 동의 상태
  const [terms, setTerms] = useState({
    all: false,
    service: false,
    privacy: false,
    marketing: false,
  });

  // 입력 폼 상태 (loginId 제거, email을 최상단으로 이동)
  const [formData, setFormData] = useState({
    email: "", // ID 역할
    password: "", // 비밀번호
    name: "", // 성함 (백엔드 DTO에 추가 필요할 수 있음)
    nickname: "", // 닉네임
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 약관 전체 동의 로직
  const handleAllCheck = (checked) => {
    setTerms({
      all: checked,
      service: checked,
      privacy: checked,
      marketing: checked,
    });
  };

  // 개별 약관 동의 로직
  const handleSingleCheck = (field, checked) => {
    setTerms((prev) => {
      const newTerms = { ...prev, [field]: checked };
      const allChecked =
        newTerms.service && newTerms.privacy && newTerms.marketing;
      return { ...newTerms, all: allChecked };
    });
  };

  // 입력값 변경 핸들러
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 다음 단계 이동 (약관 동의 검증)
  const handleNextStep = () => {
    if (!terms.service || !terms.privacy) {
      alert("필수 약관에 동의해주셔야 합니다.");
      return;
    }
    setStep(2);
    setError("");
  };

  // 회원가입 제출
  const handleSubmit = async () => {
    // 유효성 검사 (loginId 제외됨)
    if (
      !formData.email ||
      !formData.password ||
      !formData.name ||
      !formData.nickname
    ) {
      setError("모든 정보를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";

      // 전송 데이터: loginId 없이 email, password, name, nickname 전송
      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("회원가입 성공! 로그인 해주세요.");
        navigate("/auth/login");
      } else {
        const data = await response.json();
        throw new Error(data.message || "회원가입에 실패했습니다.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================== Styles ================== */
  const pageBackgroundStyle = {
    backgroundColor: "#F2F0FF",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  const containerStyle = {
    maxWidth: "600px",
    width: "90%",
    margin: "40px auto",
    backgroundColor: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const stepperContainerStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: "40px",
  };

  const stepItemStyle = (isActive) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    zIndex: 2,
    color: isActive ? "#8B3DFF" : "#9CA3AF",
    fontWeight: isActive ? "700" : "500",
  });

  const stepCircleStyle = (isActive) => ({
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: isActive ? "#8B3DFF" : "#E5E7EB",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "8px",
    fontSize: "20px",
    transition: "all 0.3s ease",
  });

  const lineStyle = {
    width: "100px",
    height: "2px",
    backgroundColor: "#E5E7EB",
    margin: "0 10px",
    marginTop: "-30px",
  };

  const contentBoxStyle = {
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
    width: "100%",
  };

  const titleStyle = {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "30px",
    textAlign: "center",
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: "8px",
  };

  const inputStyle = {
    width: "100%",
    height: "50px",
    padding: "0 16px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    backgroundColor: "#F9FAFB",
    fontSize: "15px",
    marginBottom: "20px",
    outline: "none",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    width: "100%",
    height: "56px",
    backgroundColor: "#8B3DFF",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "10px",
    transition: "background-color 0.2s",
  };

  const checkboxContainerStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "16px",
    cursor: "pointer",
  };

  const checkboxInputStyle = {
    accentColor: "#8B3DFF",
    width: "18px",
    height: "18px",
    marginRight: "10px",
    cursor: "pointer",
  };

  return (
    <div style={pageBackgroundStyle}>
      <Header />

      <div style={containerStyle}>
        {/* Stepper UI */}
        <div style={stepperContainerStyle}>
          <div style={stepItemStyle(step === 1)}>
            <div style={stepCircleStyle(step === 1)}>🛡️</div>
            <span>약관 동의</span>
          </div>
          <div style={lineStyle}></div>
          <div style={stepItemStyle(step === 2)}>
            <div style={stepCircleStyle(step === 2)}>👤</div>
            <span>생성정보 입력</span>
          </div>
        </div>

        {/* Step 1: 약관 동의 */}
        {step === 1 && (
          <div style={contentBoxStyle}>
            <h2 style={titleStyle}>약관 동의</h2>

            <div
              style={{
                padding: "20px",
                border: "1px solid #F3F4F6",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              <label
                style={{
                  ...checkboxContainerStyle,
                  fontWeight: "700",
                  marginBottom: "20px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #eee",
                }}
              >
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={terms.all}
                  onChange={(e) => handleAllCheck(e.target.checked)}
                />
                전체 동의하기
              </label>

              <label style={checkboxContainerStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={terms.service}
                  onChange={(e) =>
                    handleSingleCheck("service", e.target.checked)
                  }
                />
                이용약관에 동의합니다{" "}
                <span style={{ color: "#8B3DFF" }}>*</span>
              </label>

              <label style={checkboxContainerStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={terms.privacy}
                  onChange={(e) =>
                    handleSingleCheck("privacy", e.target.checked)
                  }
                />
                개인정보 처리방침에 동의합니다{" "}
                <span style={{ color: "#8B3DFF" }}>*</span>
              </label>

              <label style={checkboxContainerStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={terms.marketing}
                  onChange={(e) =>
                    handleSingleCheck("marketing", e.target.checked)
                  }
                />
                마케팅 정보 활용 동의 (선택)
              </label>
            </div>

            <button style={buttonStyle} onClick={handleNextStep}>
              동의
            </button>
          </div>
        )}

        {/* Step 2: 정보 입력 */}
        {step === 2 && (
          <div style={contentBoxStyle}>
            <h2 style={titleStyle}>생성정보 입력</h2>

            {error && (
              <div
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#EF4444",
                  padding: "10px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  textAlign: "center",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <div>
              {/* ✅ 이메일을 가장 위로 배치 (로그인 ID 대체) */}
              <label style={labelStyle}>이메일</label>
              <input
                type="email"
                style={inputStyle}
                placeholder="사용하실 이메일을 입력해주세요"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />

              <label style={labelStyle}>비밀번호</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="비밀번호를 입력해주세요"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
              />

              <label style={labelStyle}>성함</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="성함을 입력해주세요"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />

              <label style={labelStyle}>닉네임</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="닉네임을 입력해주세요"
                value={formData.nickname}
                onChange={(e) => handleInputChange("nickname", e.target.value)}
              />
            </div>

            <button
              style={buttonStyle}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "처리중..." : "회원가입 완료"}
            </button>
          </div>
        )}

        {/* 로그인 전환 링크 */}
        <div style={{ marginTop: "20px", fontSize: "14px", color: "#6B7280" }}>
          이미 계정이 있으신가요?{" "}
          <Link
            to="/auth/login"
            style={{
              color: "#8B3DFF",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            로그인
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Signup;
