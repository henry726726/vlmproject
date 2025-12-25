import React, { useState, useEffect } from "react";
import axios from "axios";
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

// ===================== FacebookInput 컴포넌트 =====================
function FacebookInput() {
  const navigate = useNavigate();
  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8080";

  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");

  const [adSettings, setAdSettings] = useState({
    accountId: "",
    pageId: "",
    link: "",
    billingEvent: "IMPRESSIONS",
    optimizationGoal: "LINK_CLICKS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    dailyBudget: "",
    startTime: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [adCreatedOrUpdated, setAdCreatedOrUpdated] = useState(false);

  // Header용 로그아웃 함수
  const handleHeaderLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login");
  };

  // 광고 계정 목록 불러오기
  useEffect(() => {
    const jwtToken = localStorage.getItem("jwtToken");
    if (!jwtToken) return;

    axios
      .get(`${apiBase}/meta/adaccounts`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      })
      .then((res) => setAdAccounts(res.data))
      .catch((err) => console.error("광고 계정 불러오기 실패:", err));
  }, [apiBase]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAdSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAccountSelect = (e) => {
    const value = e.target.value;
    setSelectedAccount(value);
    if (value) {
      const [accountId, pageId] = value.split(",");
      setAdSettings((prev) => ({
        ...prev,
        accountId,
        pageId,
      }));
    } else {
      setAdSettings((prev) => ({
        ...prev,
        accountId: "",
        pageId: "",
      }));
    }
  };

  const handleCreateAd = async () => {
    if (!adSettings.accountId || !adSettings.pageId) {
      alert("광고 계정을 선택해 주세요.");
      return;
    }
    if (!adSettings.link) {
      alert("랜딩 URL을 입력해 주세요.");
      return;
    }
    if (!adSettings.dailyBudget || !adSettings.startTime) {
      alert("하루 예산과 광고 시작 시간은 필수 입력 항목입니다! 😅");
      return;
    }

    const jwtToken = localStorage.getItem("jwtToken");
    if (!jwtToken) {
      alert("로그인이 필요합니다!");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        accountId: adSettings.accountId,
        pageId: adSettings.pageId,
        link: adSettings.link,
        billingEvent: adSettings.billingEvent,
        optimizationGoal: adSettings.optimizationGoal,
        bidStrategy: adSettings.bidStrategy,
        dailyBudget: adSettings.dailyBudget,
        startTime: adSettings.startTime,
      };

      const response = await axios.post(`${apiBase}/meta/create-ad`, payload, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("광고 생성 응답:", response.data);
      alert("광고가 성공적으로 생성되었습니다! 🎉");
      setAdCreatedOrUpdated(true);
    } catch (error) {
      console.error("광고 생성 실패:", error);
      const message =
        error.response?.data?.message ||
        error.response?.data ||
        "광고 생성 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  const canShowCreateAdButton =
    adSettings.link && adSettings.dailyBudget && adSettings.startTime;
  const buttonText = adCreatedOrUpdated ? "광고 업로드하기" : "광고 생성하기";

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
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "700px", // 폼이 조금 길어서 넓게 잡음
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  const titleStyle = {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "30px",
    textAlign: "center",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: "600",
    color: "#374151",
    fontSize: "0.95rem",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    fontSize: "1rem",
    backgroundColor: "#F9FAFB",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "16px", // 각 입력폼 사이 간격
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    marginTop: "20px",
    backgroundColor: isSaving ? "#E5E7EB" : "#8B3DFF",
    color: isSaving ? "#9CA3AF" : "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.1rem",
    fontWeight: "700",
    cursor: isSaving ? "not-allowed" : "pointer",
    transition: "background-color 0.2s ease",
  };

  // 미리보기 테이블 스타일
  const previewBoxStyle = {
    marginTop: "40px",
    padding: "20px",
    backgroundColor: "#F3F4F6", // gray-100
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
  };

  const previewRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #E5E7EB",
    fontSize: "0.95rem",
  };

  const previewLabelStyle = {
    color: "#6B7280",
    fontWeight: "500",
  };

  const previewValueStyle = {
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
    maxWidth: "60%",
    wordBreak: "break-all", // URL 등이 길어질 때 줄바꿈
  };

  return (
    <div style={pageContainerStyle}>
      <Header
        isLoggedIn={Boolean(localStorage.getItem("jwtToken"))}
        onLogout={handleHeaderLogout}
      />

      <main style={mainContentStyle}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>페이스북 광고 설정</h2>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* 광고 계정 선택 */}
            <div>
              <label style={labelStyle}>광고 계정</label>
              <select
                value={selectedAccount}
                onChange={handleAccountSelect}
                style={inputStyle}
              >
                <option value="">-- 계정 선택 --</option>
                {adAccounts.map((acc) => (
                  <option
                    key={`${acc.accountId}_${acc.pageId}`}
                    value={`${acc.accountId},${acc.pageId}`}
                  >
                    {acc.name} ({acc.accountId})
                  </option>
                ))}
              </select>
            </div>

            {/* 랜딩 URL */}
            <div>
              <label style={labelStyle}>랜딩 URL (Link)</label>
              <input
                type="url"
                name="link"
                value={adSettings.link}
                onChange={handleChange}
                placeholder="https://example.com"
                style={inputStyle}
              />
            </div>

            {/* 과금 기준 */}
            <div>
              <label style={labelStyle}>과금 기준</label>
              <select
                name="billingEvent"
                value={adSettings.billingEvent}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="IMPRESSIONS">노출 (IMPRESSIONS)</option>
                <option value="LINK_CLICKS">링크 클릭 (LINK_CLICKS)</option>
              </select>
            </div>

            {/* 최적화 목표 */}
            <div>
              <label style={labelStyle}>최적화 목표</label>
              <select
                name="optimizationGoal"
                value={adSettings.optimizationGoal}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="LINK_CLICKS">링크 클릭</option>
                <option value="REACH">도달</option>
                <option value="CONVERSIONS">전환</option>
              </select>
            </div>

            {/* 입찰 방식 */}
            <div>
              <label style={labelStyle}>입찰 방식</label>
              <select
                name="bidStrategy"
                value={adSettings.bidStrategy}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="LOWEST_COST_WITHOUT_CAP">최저 비용</option>
                <option value="COST_CAP">비용 상한</option>
              </select>
            </div>

            {/* 하루 예산 */}
            <div>
              <label style={labelStyle}>하루 예산 (원)</label>
              <input
                type="number"
                name="dailyBudget"
                value={adSettings.dailyBudget}
                onChange={handleChange}
                placeholder="예: 15000"
                style={inputStyle}
              />
            </div>

            {/* 광고 시작 시간 */}
            <div>
              <label style={labelStyle}>광고 시작 시간</label>
              <input
                type="datetime-local"
                name="startTime"
                value={adSettings.startTime}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            {/* 버튼 */}
            {canShowCreateAdButton && (
              <button
                onClick={handleCreateAd}
                disabled={isSaving}
                style={buttonStyle}
                onMouseOver={(e) => {
                  if (!isSaving)
                    e.currentTarget.style.backgroundColor = "#7C3AED";
                }}
                onMouseOut={(e) => {
                  if (!isSaving)
                    e.currentTarget.style.backgroundColor = "#8B3DFF";
                }}
              >
                {isSaving ? "메타 광고 생성 중..." : buttonText}
              </button>
            )}
          </div>

          {/* 미리보기 영역 */}
          <div style={previewBoxStyle}>
            <h3
              style={{
                fontSize: "1.1rem",
                color: "#111827",
                marginBottom: "15px",
                textAlign: "center",
              }}
            >
              📋 설정 미리보기
            </h3>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>광고 계정</span>
              <span style={previewValueStyle}>
                {selectedAccount
                  ? `${adSettings.accountId} / ${adSettings.pageId}`
                  : "-"}
              </span>
            </div>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>랜딩 URL</span>
              <span style={previewValueStyle}>{adSettings.link || "-"}</span>
            </div>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>과금 기준</span>
              <span style={previewValueStyle}>{adSettings.billingEvent}</span>
            </div>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>최적화 목표</span>
              <span style={previewValueStyle}>
                {adSettings.optimizationGoal}
              </span>
            </div>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>입찰 방식</span>
              <span style={previewValueStyle}>{adSettings.bidStrategy}</span>
            </div>
            <div style={previewRowStyle}>
              <span style={previewLabelStyle}>하루 예산</span>
              <span style={previewValueStyle}>
                {adSettings.dailyBudget
                  ? `${parseInt(adSettings.dailyBudget).toLocaleString()} 원`
                  : "-"}
              </span>
            </div>
            <div style={{ ...previewRowStyle, borderBottom: "none" }}>
              <span style={previewLabelStyle}>시작 시간</span>
              <span style={previewValueStyle}>
                {adSettings.startTime
                  ? new Date(adSettings.startTime).toLocaleString()
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default FacebookInput;
