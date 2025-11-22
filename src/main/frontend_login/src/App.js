// src/App.js

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

// 페이지/컴포넌트들
import LoginSignup from "./components/LoginSignup/LoginSignup";
import MyPage from "./components/MyPage/MyPage";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import MainPage from "./components/MainPage/MainPage";

import TextGenerator from "./TextGenerator";
import ImageGenerator from "./ImageGenerator";
import FacebookInput from "./FacebookInput";
import MetaAdManager from "./MetaAdManager";
import AdWaitingModal from "./AdWaitingModal";
import SaveAdAccounts from "./Pages/SaveAdAccounts";
import SyncAdInfo from "./Pages/SyncAdInfo";
import AccessTokenInput from "./Pages/AccessTokenInput";
import "./App.css"; // ✨✨ 바로 여기!! 이 한 줄을 추가해주는 거야! ✨✨

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(false); // userData 초기값 변경 (false -> null)
  // [userData, setUserData] = useState(null); // userData 초기값 null로 이미 잘 되어있네, 내 실수!

  // 앱 시작 시 JWT 확인 → 자동 로그인
  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 > Date.now()) {
        setUserData({ email: decoded.sub, roles: decoded.auth });
        setIsLoggedIn(true);
      } else {
        localStorage.removeItem("jwtToken");
      }
    } catch (e) {
      console.error("JWT 디코딩 오류:", e);
      localStorage.removeItem("jwtToken");
    }
  }, []);

  const handleLogin = (userInfo) => {
    setUserData(userInfo);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserData(null);
    localStorage.removeItem("jwtToken");
  };

  return (
    <Routes>
      {/* 인증 페이지 */}
      <Route
        path="/auth/login"
        element={
          <ErrorBoundary>
            <LoginSignup onLogin={handleLogin} />
          </ErrorBoundary>
        }
      />
      <Route
        path="/auth/signup"
        element={
          <ErrorBoundary>
            <LoginSignup onLogin={handleLogin} />
          </ErrorBoundary>
        }
      />

      {/* 메인 */}
      <Route
        path="/"
        element={
          <MainPage
            userData={userData}
            onLogout={handleLogout}
            isLoggedIn={isLoggedIn}
          />
        }
      />

      {/* 보호 라우트들 */}
      <Route
        path="/text-generator"
        element={
          isLoggedIn ? <TextGenerator /> : <Navigate to="/auth/login" replace />
        }
      />
      <Route
        path="/image-generator"
        element={
          isLoggedIn ? (
            <ImageGenerator />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route
        path="/facebook-input"
        element={
          isLoggedIn ? <FacebookInput /> : <Navigate to="/auth/login" replace />
        }
      />
      <Route
        path="/meta-ad-manager"
        element={
          isLoggedIn ? <MetaAdManager /> : <Navigate to="/auth/login" replace />
        }
      />
      <Route
        path="/ad-waiting"
        element={
          isLoggedIn ? (
            <AdWaitingModal isOpen={true} onClose={() => {}} />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route
        path="/mypage"
        element={
          isLoggedIn ? (
            <MyPage userData={userData} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route
        path="/save-access-token"
        element={
          isLoggedIn ? (
            <AccessTokenInput />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route
        path="/save-ad-accounts"
        element={
          isLoggedIn ? (
            <SaveAdAccounts />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route
        path="/sync-ad-info"
        element={
          isLoggedIn ? <SyncAdInfo /> : <Navigate to="/auth/login" replace />
        }
      />

      {/* 나머지는 메인으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
