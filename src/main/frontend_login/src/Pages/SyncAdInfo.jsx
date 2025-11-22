// src/Pages/SyncAdInfo.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom"; // Header/Footer에서 사용

// ===================== 스타일 객체 (Header/Footer에서 사용) =====================
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

// ===================== Header 컴포넌트 (SyncAdInfo.jsx 내부에 정의) =====================
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

// ===================== Footer 컴포넌트 (SyncAdInfo.jsx 내부에 정의) =====================
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

// ===================== SyncAdInfo 컴포넌트 =====================
function SyncAdInfo() {
  const navigate = useNavigate(); // navigate 추가
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [message, setMessage] = useState("");

  // Header에 전달할 onLogout 함수 정의
  const handleHeaderLogout = () => {
    localStorage.removeItem("jwtToken");
    navigate("/auth/login"); // navigate 사용
  };

  // 현재 로그인 상태 (Header 컴포넌트에 전달하기 위함)
  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  // 🔹 광고 계정 리스트 로드
  useEffect(() => {
    const jwt = localStorage.getItem("jwtToken"); // jwt를 useEffect 내부에서 읽도록 변경
    if (!jwt) {
      setMessage("❌ 로그인이 필요합니다.");
      return;
    }

    const axiosConfig = {
      // axiosConfig도 useEffect 내부에서 정의
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    };

    const fetchAdAccounts = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8080/meta/adaccounts",
          axiosConfig
        );
        setAdAccounts(response.data);
      } catch (error) {
        console.error("광고 계정 불러오기 실패:", error);
        setMessage("❌ 광고 계정 불러오기 실패");
      }
    };

    fetchAdAccounts();
  }, []); // 의존성 배열을 비워 한 번만 실행되도록 유지

  // 🔹 광고 정보 동기화
  const handleSyncAds = async () => {
    if (!selectedAccount) {
      setMessage("❗ 광고 계정을 선택해주세요.");
      return;
    }

    const jwt = localStorage.getItem("jwtToken"); // handleSyncAds 내부에서도 jwt를 다시 읽음
    if (!jwt) {
      setMessage("❌ 로그인이 필요합니다.");
      return;
    }

    // 👉 accountId,pageId 형식에서 분리
    const [accountId] = selectedAccount.split(","); // pageId는 사용되지 않으므로, accountId만 추출

    try {
      const res = await axios.get(
        `http://localhost:8080/meta/sync-ads?adAccountId=${accountId}&accessToken=${jwt}`,
        {
          headers: { Authorization: `Bearer ${jwt}` }, // axiosConfig 대신 직접 headers 전달
        }
      );
      setMessage(res.data || "✅ 광고 정보 동기화 완료");
    } catch (error) {
      console.error("광고 정보 동기화 실패:", error);
      setMessage(
        "❌ 광고 정보 동기화 실패: " + (error.response?.data || error.message)
      );
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* 헤더 */}
      <Header isLoggedIn={isLoggedIn} onLogout={handleHeaderLogout} />

      {/* 메인 콘텐츠 영역 (남은 공간을 차지하여 푸터를 아래로 밀어냄) */}
      <main style={{ flexGrow: 1 }}>
        <div
          style={{
            padding: "30px",
            maxWidth: "700px",
            margin: "0 auto",
            fontFamily: "'Noto Sans KR', sans-serif",
            color: "#333",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "20px",
              color: "#ffffffff",
            }}
          >
            📊 광고 정보 동기화
          </h2>

          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <label style={{ fontWeight: "bold", color: "#ffffff" }}>
              📌 광고 계정 선택:
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{
                marginLeft: "10px",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            >
              <option value="">-- 선택 --</option>
              {adAccounts.map((acc) => (
                <option
                  key={`${acc.accountId}_${acc.pageId}`}
                  value={`${acc.accountId},${acc.pageId}`}
                >
                  {acc.name} ({acc.accountId})
                </option>
              ))}
            </select>
            <button
              onClick={handleSyncAds}
              style={{
                marginLeft: "15px",
                padding: "8px 15px",
                backgroundColor: "#6243a5",
                color: "white",
                border: "none",
                borderRadius: "5px",
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.3s ease",
              }}
            >
              광고 동기화
            </button>
          </div>

          {message && (
            <p
              style={{
                marginTop: "15px",
                textAlign: "center",
                color: message.startsWith("✅") ? "#4CAF50" : "#ff6347",
              }}
            >
              {message}
            </p>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}

export default SyncAdInfo;
