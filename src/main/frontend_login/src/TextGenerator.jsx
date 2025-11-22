//src/TextGenerator.jsx

import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

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

function TextGenerator() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    product: "",
    target: "",
    purpose: "",
    keyword: "",
    duration: "",
  });
  const [adTexts, setAdTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prevForm) => ({ ...prevForm, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAdTexts([]);
    setError("");

    const formValues = Object.values(form);
    const isValid = formValues.every((value) => value.trim() !== "");
    if (!isValid) {
      setError("모든 필드를 입력해주세요! 😅");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("jwtToken");
    if (!token) {
      setError("로그인이 필요합니다. 다시 로그인해주세요!");
      navigate("/auth/login");
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8080";
      const res = await axios.post(`${apiUrl}/api/generate`, form, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setAdTexts(res.data.adTexts || []);
    } catch (err) {
      console.error("❌ 광고 문구 생성 오류:", err);
      const errorMessage =
        err.response && err.response.status === 401
          ? "인증이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요."
          : err.response?.data?.message ||
            err.message ||
            "광고 문구 생성 중 오류가 발생했습니다. 백엔드 서버를 확인해주세요.";
      setError(errorMessage);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("jwtToken");
        navigate("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectText = (chosenText) => {
    if (!chosenText) {
      setError("선택할 문구가 없습니다.");
      return;
    }
    localStorage.setItem("selectedText", chosenText);
    localStorage.setItem("selectedAdText", chosenText);
    localStorage.setItem("Product", form.product || "");
    localStorage.setItem("textGenParams", JSON.stringify(form));
    navigate("/image-generator");
  };

  const inputStyle = {
    width: "575px",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #7c4dff",
    fontSize: "1.1em",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    boxShadow: "inset 0 1px 5px rgba(0,0,0,0.3)",
    outline: "none",
    color: "#e0e0ff",
  };

  const buttonStyle = {
    width: "100%",
    padding: 15,
    background: "linear-gradient(45deg, #a8e6cf, #88d8a3)",
    color: "#1a0f3d",
    border: "none",
    borderRadius: 10,
    fontSize: "1.2em",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 5px 15px rgba(168,230,207,0.4)",
    transition: "all 0.3s ease",
  };

  const adTextButtonStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "1px solid #bb86fc",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    fontSize: "1.1em",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
    color: "#e0e0ff",
    transition: "background-color 0.3s ease, box-shadow 0.3s ease",
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

      <main
        style={{
          maxWidth: 600,
          margin: "40px auto",
          padding: 30,
          background: "linear-gradient(135deg, #1a0f3d 0%, #3e1b6a 100%)",
          borderRadius: 15,
          boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
          fontFamily: "'Noto Sans KR', sans-serif",
          color: "#e0e0ff",
          minHeight: "65vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2
          style={{
            color: "#A8E6CF",
            textAlign: "center",
            marginBottom: 30,
            fontSize: "2em",
            fontWeight: 600,
            textShadow: "0 0 15px rgba(168,230,207,0.5)",
          }}
        >
          광고 문구 생성기
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 15 }}
        >
          <input
            name="product"
            value={form.product}
            onChange={handleChange}
            placeholder="제품명 (예: 럭셔리 시계)"
            style={inputStyle}
          />
          <input
            name="target"
            value={form.target}
            onChange={handleChange}
            placeholder="타겟 (예: 30대 남성 직장인)"
            style={inputStyle}
          />
          <input
            name="purpose"
            value={form.purpose}
            onChange={handleChange}
            placeholder="목적 (예: 구매 유도, 브랜드 인지도 향상)"
            style={inputStyle}
          />
          <input
            name="keyword"
            value={form.keyword}
            onChange={handleChange}
            placeholder="강조 키워드 (예: 프리미엄, 한정판)"
            style={inputStyle}
          />
          <input
            name="duration"
            value={form.duration}
            onChange={handleChange}
            placeholder="광고 기간 (예: 5일, 1개월)"
            style={inputStyle}
          />

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "생성 중..." : "광고 문구 생성하기 "}
          </button>
        </form>

        {error && (
          <p
            style={{
              color: "#ff6b6b",
              marginTop: 20,
              textAlign: "center",
              fontWeight: "bold",
              backgroundColor: "rgba(255, 107, 107, 0.2)",
              padding: 10,
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        )}

        {adTexts.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <h2
              style={{
                color: "#d1c4e9",
                marginBottom: 15,
                fontSize: "1.3em",
                fontWeight: 600,
              }}
            >
              👇 문구를 선택하세요:
            </h2>
            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                padding: 10,
                borderRadius: 10,
                background: "rgba(0,0,0,0.1)",
              }}
            >
              {adTexts.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectText(t)}
                  style={adTextButtonStyle}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}

export default TextGenerator;
