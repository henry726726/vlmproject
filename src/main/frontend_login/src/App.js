// src/App.js

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

// 페이지/컴포넌트들
import LoginSignup from "./components/LoginSignup/LoginSignup";
import MyPage from "./components/MyPage/MyPage";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import MainPage from "./components/MainPage/MainPage";

// 새로 만든 LandingPage 임포트 (파일 경로 확인 필요, src/ex_main.jsx라고 가정)
import LandingPage from "./ex_main"; 

import TextGenerator from "./TextGenerator";
import ImageGenerator from "./ImageGenerator";
import FacebookInput from "./FacebookInput";
import MetaAdManager from "./MetaAdManager";
import AdWaitingModal from "./AdWaitingMoㅊㅇdal";
import SaveAdAccounts from "./Pages/SaveAdAccounts";
import SyncAdInfo from "./Pages/SyncAdInfo";
import AccessTokenInput from "./Pages/AccessTokenInput";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null); 

  // 앱 시작 시 JWT 확인 → 자동 로그인 로직 (기존 유지)
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
      {/* ✅ 메인 라우트 변경 핵심:
         로그인 상태면 -> MainPage (대시보드)
         로그인 안했으면 -> LandingPage (ex_main, Canva 스타일 소개 페이지)
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

      {/* 보호된 라우트들 (기존 유지) */}
      <Route
        path="/text-generator"
        element={
          isLoggedIn ? <TextGenerator /> : <Navigate to="/auth/login" replace />
        }
      />
      <Route
        path="/image-generator"
        element={
          isLoggedIn ? <ImageGenerator /> : <Navigate to="/auth/login" replace />
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
      
      {/* ... 나머지 라우트들 (save-access-token 등) 기존과 동일하게 유지 ... */}
      <Route
        path="/save-access-token"
        element={isLoggedIn ? <AccessTokenInput /> : <Navigate to="/auth/login" replace />}
      />
      <Route
        path="/save-ad-accounts"
        element={isLoggedIn ? <SaveAdAccounts /> : <Navigate to="/auth/login" replace />}
      />
      <Route
        path="/sync-ad-info"
        element={isLoggedIn ? <SyncAdInfo /> : <Navigate to="/auth/login" replace />}
      />

      {/* 잘못된 경로는 메인으로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;