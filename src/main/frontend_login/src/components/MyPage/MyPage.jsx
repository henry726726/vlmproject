// src/components/MyPage/MyPage.jsx

import React, { useState, useEffect, useRef, useCallback } from "react"; // useCallback import 추가
import "./MyPage.css"; // MyPage.css 파일 스타일은 이 파일에 정의되어야 함
import { Link, useNavigate } from "react-router-dom"; // Link는 Header/Footer에서 사용되므로 유지합니다.
import user_icon from "../Assets/person.png";
import email_icon from "../Assets/email.png";
// import edit_icon from '../Assets/password.png' // 'edit_icon' is defined but never used 경고 해소

// ===================== 상수 =====================
const AUTO_LOGOUT_MINUTES = 90;
const AUTO_LOGOUT_MS = AUTO_LOGOUT_MINUTES * 60 * 1000;

// 헤더/푸터 스타일 (FacebookInput.jsx와 동일하게 적용)
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

// ===================== Header 컴포넌트 (MyPage.jsx 내부에 정의) =====================
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

// ===================== Footer 컴포넌트 (MyPage.jsx 내부에 정의) =====================
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

// ===================== MyPage 컴포넌트 =====================
const MyPage = ({ userData }) => {
  // onLogout은 MyPage 내부 handleLogout으로 관리
  const navigate = useNavigate(); // useNavigate 훅 추가
  const [userInfo, setUserInfo] = useState(
    userData || {
      nickname: "User",
      email: "user@example.com",
      joinDate: "2025-01-01", // userData에 joinDate와 bio가 없을 경우를 대비하여 추가
      bio: "안녕하세요. 광고 매니저입니다.",
    }
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editInfo, setEditInfo] = useState(userInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(AUTO_LOGOUT_MS);
  const timerRef = useRef();
  const lastActivityRef = useRef(Date.now());

  const handleLogout = useCallback(async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      // 토큰을 사용하는 경우, 여기서 토큰 삭제
      localStorage.removeItem("jwtToken");

      await fetch(`${apiUrl}/api/logout`, {
        // 서버에 로그아웃 요청 (세션 무효화 등)
        method: "POST",
        credentials: "include", // 쿠키 기반 세션 사용 시
      });
      alert("로그아웃 되었습니다.");
    } catch (error) {
      console.error("Logout error:", error);
      alert("로그아웃 중 오류가 발생했지만, 세션을 종료합니다.");
    } finally {
      navigate("/auth/login"); // 항상 로그인 페이지로 리다이렉트
      window.location.reload(); // 페이지 새로고침
    }
  }, [navigate]); // navigate 의존성 추가

  // handleAutoLogout 함수를 useCallback으로 감싸 의존성 경고 해결 및 성능 최적화
  const handleAutoLogout = useCallback(async () => {
    try {
      // 자동 로그아웃 시 클라이언트 토큰 삭제
      localStorage.removeItem("jwtToken");

      const apiUrl = process.env.REACT_APP_API_URL;
      await fetch(`${apiUrl}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Auto logout failed:", error);
    }
    alert("활동이 없어 자동 로그아웃되었습니다. 다시 로그인해주세요.");
    navigate("/auth/login"); // 자동 로그아웃 후 로그인 페이지로 리다이렉트
    window.location.reload(); // 페이지 새로고침
  }, [navigate]); // navigate 의존성 추가

  // Reset timer on user activity
  useEffect(() => {
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      setRemaining(AUTO_LOGOUT_MS);
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    setRemaining(AUTO_LOGOUT_MS); // 컴포넌트 마운트 시 초기 remaining 값 설정

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeLeft = AUTO_LOGOUT_MS - elapsed;
      setRemaining(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(timerRef.current);
        handleAutoLogout(); // useCallback으로 감싸진 함수 호출
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [handleAutoLogout]); // handleAutoLogout을 의존성 배열에 추가하여 react-hooks/exhaustive-deps 경고 해결

  const handleEdit = () => {
    setIsEditing(true);
    setEditInfo(userInfo);
    setError("");
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const jwtToken = localStorage.getItem("jwtToken"); // JWT 토큰 가져오기

      if (!jwtToken) {
        throw new Error("프로필을 업데이트하려면 로그인이 필요합니다.");
      }

      const response = await fetch(`${apiUrl}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`, // JWT 토큰을 Authorization 헤더에 추가
        },
        // credentials: 'include', // JWT 사용 시 쿠키는 보통 사용 안 함 (서버 설정에 따름)
        body: JSON.stringify({
          nickname: editInfo.nickname,
          email: editInfo.email,
          bio: editInfo.bio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "프로필 업데이트 중 오류 발생");
      }

      setUserInfo(editInfo);
      setIsEditing(false);
      alert("프로필이 성공적으로 업데이트되었습니다.");
    } catch (error) {
      console.error("Save error:", error);
      setError(error.message);
      if (error.message.includes("로그인") || error.response?.status === 401) {
        // 401 Unauthorized 오류 처리
        alert("세션이 만료되었거나 로그인이 필요합니다.");
        handleLogout(); // 로그아웃 처리
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditInfo(userInfo);
    setError("");
  };

  const handleInputChange = (field, value) => {
    setEditInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // PDF 리포트 생성 버튼 클릭 이벤트 핸들러
  const handleGeneratePdf = async () => {
    setLoading(true);
    setError("");
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "";
      const jwtToken = localStorage.getItem("jwtToken"); // JWT 토큰 가져오기

      if (!jwtToken) {
        alert(
          "PDF 리포트를 생성하려면 로그인이 필요합니다. 다시 로그인해주세요."
        );
        setLoading(false);
        return; // 토큰이 없으면 함수 종료
      }

      const response = await fetch(`${apiUrl}/api/report/pdf`, {
        method: "GET",
        // credentials: 'include', // JWT 사용 시 이 부분은 보통 제거하거나 유지해도 무관 (서버 설정에 따름)
        headers: {
          Authorization: `Bearer ${jwtToken}`, // JWT 토큰을 Authorization 헤더에 추가
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 401 오류 메시지를 좀 더 명확하게 처리
        if (response.status === 401) {
          throw new Error(
            `PDF 생성 실패: 세션이 만료되었거나 로그인이 필요합니다.`
          );
        }
        throw new Error(`PDF 생성 실패: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // 새 탭에서 PDF 열기 (기본 동작)
      window.open(url, "_blank");
      alert("PDF 리포트가 성공적으로 생성되었습니다!");
    } catch (err) {
      console.error("PDF 생성 중 오류:", err);
      setError("PDF 생성 중 오류가 발생했습니다: " + err.message);
      if (err.message.includes("로그인") || err.response?.status === 401) {
        // 401 Unauthorized 오류 처리
        alert("세션이 만료되었거나 로그인이 필요합니다.");
        handleLogout(); // 로그아웃 처리
      }
    } finally {
      setLoading(false);
    }
  };

  // 자동 로그아웃까지 남은 시간을 HH:MM:SS 형태로 포맷팅
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
      2,
      "0"
    )}s`;
  };

  // 현재 로그인 상태 (Header 컴포넌트에 전달하기 위함)
  const isLoggedIn = Boolean(localStorage.getItem("jwtToken"));

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* 헤더 컴포넌트 */}
      <Header isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      {/* 메인 콘텐츠 영역 (Flexbox로 남은 공간 차지) */}
      <main
        className="mypage-container"
        style={{
          flexGrow: 1,
          padding: "20px",
          fontFamily: "'Noto Sans KR', sans-serif",
          backgroundColor: "#2a1a4a",
          color: "#e0e0ff",
        }}
      >
        <div className="mypage-header">
          <div className="mypage-title">My Profile</div>
          <div className="mypage-underline"></div>
          <div
            style={{
              marginTop: 10,
              color: "#A8E6CF",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            자동 로그아웃까지: {formatTime(remaining)}
          </div>
        </div>

        {error && (
          <div
            className="error-message"
            style={{
              color: "#ff6b6b",
              backgroundColor: "rgba(255, 107, 107, 0.1)",
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div className="profile-section">
          <div className="profile-avatar">
            <img
              src={user_icon}
              alt="Profile Avatar"
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                border: "2px solid #A8E6CF",
              }}
            />
          </div>

          <div className="profile-info">
            {!isEditing ? (
              <div className="info-display">
                <div className="info-item">
                  <img
                    src={user_icon}
                    alt="User Icon"
                    style={{ width: 20, height: 20, marginRight: 5 }}
                  />
                  <span className="label">닉네임:</span>
                  <span className="value">{userInfo.nickname}</span>
                </div>
                <div className="info-item">
                  <img
                    src={email_icon}
                    alt="Email Icon"
                    style={{ width: 20, height: 20, marginRight: 5 }}
                  />
                  <span className="label">이메일:</span>
                  <span className="value">{userInfo.email}</span>
                </div>
                <div className="info-item">
                  <span className="label">가입일:</span>
                  <span className="value">{userInfo.joinDate}</span>
                </div>
                <div className="bio-item">
                  <span className="label">소개:</span>
                  <span className="value">{userInfo.bio}</span>
                </div>
              </div>
            ) : (
              <div className="info-edit">
                <div className="edit-item">
                  <img
                    src={user_icon}
                    alt="User Icon"
                    style={{ width: 20, height: 20, marginRight: 5 }}
                  />
                  <input
                    type="text"
                    value={editInfo.nickname}
                    onChange={(e) =>
                      handleInputChange("nickname", e.target.value)
                    }
                    placeholder="Nickname"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 5,
                      border: "1px solid #7c4dff",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#e0e0ff",
                    }}
                  />
                </div>
                <div className="edit-item">
                  <img
                    src={email_icon}
                    alt="Email Icon"
                    style={{ width: 20, height: 20, marginRight: 5 }}
                  />
                  <input
                    type="email"
                    value={editInfo.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Email"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 5,
                      border: "1px solid #7c4dff",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#e0e0ff",
                    }}
                  />
                </div>
                <div
                  className="edit-item"
                  style={{ display: "flex", alignItems: "flex-start" }}
                >
                  {/* 이메일 아이콘 대신 textarea에 적절한 아이콘을 넣거나 아이콘을 제거하고 text만 사용할 수 있습니다. */}
                  <span
                    style={{ marginRight: 5, color: "#b3e1e9", paddingTop: 8 }}
                  >
                    소개:
                  </span>
                  <textarea
                    value={editInfo.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    placeholder="Bio"
                    rows="3"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 5,
                      border: "1px solid #7c4dff",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#e0e0ff",
                      minHeight: 80,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="action-buttons">
          {!isEditing ? (
            <div
              className="button-group"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 15,
                marginTop: 30,
              }}
            >
              <div
                className="action-btn edit-btn"
                onClick={handleEdit}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#A8E6CF", // 민트 계열
                  color: "#1a0f3d",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                프로필 수정
              </div>
              <button
                onClick={handleGeneratePdf}
                disabled={loading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: loading ? "#999" : "#4CAF50", // 로딩 시 회색, 평소 녹색 계열
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                {loading ? "생성 중..." : "PDF 리포트 생성"}
              </button>
              <div
                className="action-btn logout-btn"
                onClick={handleLogout}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#ff6536", // 주황색 계열
                  color: "white",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                로그아웃
              </div>
            </div>
          ) : (
            <div
              className="button-group"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 15,
                marginTop: 30,
              }}
            >
              <div
                className="action-btn save-btn"
                onClick={handleSave}
                style={{
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: "10px 20px",
                  backgroundColor: loading ? "#999" : "#A8E6CF",
                  color: "#1a0f3d",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
                disabled={loading}
              >
                {loading ? "저장 중..." : "변경 사항 저장"}
              </div>
              <div
                className="action-btn cancel-btn"
                onClick={handleCancel}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#e0e0ff", // 연한 보라
                  color: "#1a0f3d",
                  fontWeight: "bold",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                취소
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 푸터 컴포넌트 */}
      <Footer />
    </div>
  );
};

export default MyPage;
