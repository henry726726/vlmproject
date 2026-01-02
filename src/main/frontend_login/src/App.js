// src/App.js

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

// ✅ 분리된 로그인/회원가입 컴포넌트 Import
import Login from "./components/LoginSignup/Login";
import Signup from "./components/LoginSignup/Signup";

// 기존 컴포넌트들
import MyPage from "./components/MyPage/MyPage";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import MainPage from "./components/MainPage/MainPage";

// 새로 만든 LandingPage
import LandingPage from "./ex_main";

// 기능 페이지들
import TextGenerator from "./TextGenerator";
import ImageGenerator from "./ImageGenerator";
import FacebookInput from "./FacebookInput";
import MetaAdManager from "./MetaAdManager";
import AdWaitingModal from "./AdWaitingModal";
import SaveAdAccounts from "./Pages/SaveAdAccounts";
import SyncAdInfo from "./Pages/SyncAdInfo";
import AccessTokenInput from "./Pages/AccessTokenInput";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  // 앱 시작 시 JWT 확인 → 자동 로그인 로직
  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      // 토큰 만료 시간 확인 (exp는 초 단위이므로 1000을 곱해 밀리초로 변환)
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
      {/* 메인 라우트:
        로그인 상태면 -> MainPage (대시보드)
        로그인 안했으면 -> LandingPage (소개 페이지)
      */}
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <MainPage
              userData={userData}
              onLogout={handleLogout}
              isLoggedIn={isLoggedIn}
            />
          ) : (
            <LandingPage />
          )
        }
      />

      {/* ✅ 로그인 페이지 (분리됨) */}
      <Route
        path="/auth/login"
        element={
          <ErrorBoundary>
            <Login onLogin={handleLogin} />
          </ErrorBoundary>
        }
      />

      {/* ✅ 회원가입 페이지 (분리됨) */}
      <Route
        path="/auth/signup"
        element={
          <ErrorBoundary>
            <Signup />
          </ErrorBoundary>
        }
      />

      {/* ================= 보호된 라우트들 (로그인 필요) ================= */}

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
        path="/mypage"
        element={
          isLoggedIn ? (
            <MyPage userData={userData} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />

      {/* 토큰 및 광고 계정 설정 페이지 */}
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

      {/* 잘못된 경로는 메인으로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
