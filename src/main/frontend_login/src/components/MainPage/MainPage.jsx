// src/components/MainPage/MainPage.jsx (스타일만 변경된 코드 - '진짜 원본' 기준)

import React, { useState, useEffect } from "react";
import Header from "../common/Header"; /* Header 컴포넌트 임포트 */
import Footer from "../common/Footer"; /* Footer 컴포넌트 임포트 */ // ⚠️ 이 경로가 진짜 원본이면 이렇게 '../common/common/Footer'
// react-router-dom의 useNavigate 훅을 임포트하여 페이지 이동을 처리합니다.
import { useNavigate } from "react-router-dom";

/* MainPage에서는 기능 컴포넌트들을 직접 렌더링하지 않으므로, 더 이상 임포트할 필요가 없습니다. */
/*
import TextGenerator from '../../TextGenerator';
import ImageGenerator from '../../ImageGenerator';
import FacebookInput from '../../FacebookInput';
import MetaAdManager from '../../MetaAdManager';
import AdWaitingModal from '../../AdWaitingModal';
*/

function MainPage({ userData, onLogout, isLoggedIn }) {
  // onShowLogin prop은 더이상 필요하지 않습니다.
  // 페이지 전환을 위한 useNavigate 훅 사용
  const navigate = useNavigate();

  // 현재 MainPage에서는 activeComponent 상태가 더 이상 필요 없습니다.
  // const [activeComponent, setActiveComponent] = useState('text');
  // 광고 대기창 모달은 이제 App.js의 라우트에서 직접 렌더링되므로, MainPage에서 제어할 필요 없습니다.
  // const [isAdModalOpen, setIsAdModalOpen] = useState(false);

  // 메뉴 버튼 클릭 시 호출되는 핸들러 (이제 페이지 이동을 담당합니다)
  const handleMenuClick = (path) => {
    // 로그인하지 않은 상태에서 클릭하면 로그인 페이지로 이동합니다.
    if (!isLoggedIn) {
      navigate("/auth/login");
      return;
    }
    // 로그인 상태이면 해당 경로로 페이지를 이동합니다.
    navigate(path);
  };

  // 미리보기 이미지 클릭 시 호출되는 핸들러 (현재 카드 클릭과 동일한 기능)
  // 미리보기 카드는 삭제되므로, 이 함수도 더 이상 사용되지 않습니다.
  /*
  const handlePreviewClick = () => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  };
  */

  // AdWaitingModal 자동 닫힘 효과: 이제 App.js 라우트에서 직접 렌더링되므로, MainPage에서 제어할 필요 없습니다.
  /*
  useEffect(() => {
    if (isAdModalOpen) {
      const timer = setTimeout(() => {
        setIsAdModalOpen(false);
      }, 3000); // 3초 후 닫기
      return () => clearTimeout(timer);
    }
  }, [isAdModalOpen]);
  */

  /* 메뉴 버튼의 기본 스타일 (MainPage 내부에서 정의합니다.) */
  // ⭐️⭐️⭐️ 여기부터 네 요청대로 버튼 스타일만 수정된 부분이야. ⭐️⭐️⭐️
  const menuButtonStyle = {
    flex: 1 /* 4개 버튼이 부모 컨테이너 내에서 공간을 균등하게 차지 - 기존 값 유지 */,
    padding: "15px 10px" /* 내부 여백 - 기존 값 유지 */,
    color: "white" /* ✅ 글자색: 흰색으로 통일 */,
    border:
      "1px solid rgba(187,134,252,0.5)" /* ✅ 테두리: 보라색 계열에 맞게 */,
    borderRadius: "8px" /* 모서리 둥글게 - 기존 값 유지 */,
    fontSize: "1.1em" /* 글자 크기 - 기존 값 유지 */,
    fontWeight: "bold" /* 글자 굵게 - 기존 값 유지 */,
    cursor: "pointer" /* 마우스 오버 시 포인터 변경 - 기존 값 유지 */,
    transition:
      "background 0.2s ease, box-shadow 0.2s ease" /* 색상 변화 애니메이션 - 기존 값 유지 */,
    minWidth:
      "150px" /* 버튼의 최소 너비 지정 (너무 좁아지는 것 방지) - 기존 값 유지 */,
    // 호버 효과는 인라인 스타일에서 직접 주기 어려우므로, 이 객체에서는 공통 스타일만 정의.
    // 각 버튼의 `style` prop에 개별 그라데이션을 적용할 것임.
  };

  // '이미지 합성' 버튼의 색깔(45deg, #bb86fc, #a06dfb)을 기준으로 각도만 다르게 한 그라데이션 스타일 생성 함수
  const getGradientStyle = (degree) => ({
    background: `linear-gradient(${degree}deg, #bb86fc, #a06dfb)`,
    // 호버 효과는 CSS-in-JS의 인라인 스타일로는 직접 구현하기 복잡함.
    // CSS 파일(.css)을 사용하거나 styled-components 같은 라이브러리를 사용하면 훨씬 쉽게 가능함.
    // 여기서는 배경색만 변경하는 방식으로 구분감을 줬어.
  });

  // ⭐️⭐️⭐️ 여기까지 버튼 스타일 수정. 나머지는 원본 그대로야. ⭐️⭐️⭐️

  /* 컴포넌트 렌더링 부분 */
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "transparent", // ✅ 배경 투명 (글로벌 body 배경 활용)
        color: "#e0e0ff", // ✅ 기본 텍스트 색상 (MainPage에서 직접 렌더링하는 텍스트는 없지만, 일관성 유지)
      }}
    >
      {/* Header 컴포넌트: userData, onLogout, isLoggedIn 모두 전달 */}
      {/* Header 컴포넌트가 로그인/회원가입 버튼 클릭 시 useNavigate를 사용해야 하므로 onShowLogin prop은 더 이상 필요 없습니다. */}
      {/* App.js에서 Header로 전달되는 onShowLogin prop도 제거되었습니다. */}
      <Header userData={userData} onLogout={onLogout} isLoggedIn={isLoggedIn} />

      {/* 메인 기능 메뉴바 (현재 4개 버튼으로 구성: 문구/이미지/페북입력/메타관리) */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-around",
          gap: "10px",
          padding: "15px 20px",
          background: "linear-gradient(90deg, #1a0f3d 0%, #3e1b6a 100%)", // ✅ 어두운 네이비-퍼플 그라디언트 배경 (원본 유지)
          borderBottom: "1px solid rgba(98, 67, 165, 0.5)", // ✅ 테두리 색상 조정 (원본 유지)
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)", // ✅ 그림자 추가 (원본 유지)
        }}
      >
        {/* 각 메뉴 버튼: 클릭 시 handleMenuClick 호출하여 해당 경로로 이동 */}
        {/* style은 menuButtonStyle을 기본으로 하고, getGradientStyle로 각 그라데이션을 적용합니다. */}
        <button
          onClick={() => handleMenuClick("/text-generator")}
          style={{ ...menuButtonStyle, ...getGradientStyle(90) }} // 각도만 변경
        >
          문구 생성
        </button>
        <button
          onClick={() => handleMenuClick("/image-generator")}
          style={{ ...menuButtonStyle, ...getGradientStyle(45) }} // 이미지 합성 (기준이 되는 45도 각도)
        >
          이미지 합성
        </button>
        <button
          onClick={() => handleMenuClick("/facebook-input")}
          style={{ ...menuButtonStyle, ...getGradientStyle(135) }} // 각도만 변경
        >
          페이스북 입력
        </button>
        <button
          onClick={() => handleMenuClick("/meta-ad-manager")}
          style={{
            ...menuButtonStyle,
            ...getGradientStyle(180), // 각도만 변경
          }}
        >
          메타 관리
        </button>
      </nav>

      {/* 두 번째 nav (기존 코드는 이 부분까지 포함) */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-around",
          gap: "10px",
          padding: "15px 20px",
          background: "linear-gradient(90deg, #3e1b6a 0%, #0e103d 100%)", // ✅ 두 번째 nav 그라디언트 (첫 번째와 반대 방향 - 원본 유지)
          borderBottom: "1px solid rgba(98, 67, 165, 0.5)", // ✅ 테두리 색상 조정 (원본 유지)
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)", // ✅ 그림자 추가 (원본 유지)
        }}
      >
        <button
          onClick={() => handleMenuClick("/save-access-token")}
          style={{ ...menuButtonStyle, ...getGradientStyle(225) }} // 각도만 변경
        >
          액세스토큰 저장
        </button>
        <button
          onClick={() => handleMenuClick("/save-ad-accounts")}
          style={{
            ...menuButtonStyle,
            ...getGradientStyle(270), // 각도만 변경
          }}
        >
          광고 계정 저장
        </button>
        <button
          onClick={() => handleMenuClick("/sync-ad-info")}
          style={{
            ...menuButtonStyle,
            ...getGradientStyle(315), // 각도만 변경
          }}
        >
          광고 동기화
        </button>
      </nav>

      {/* 활성 컴포넌트 렌더링 영역 (MainPage는 더 이상 다른 기능 컴포넌트들을 직접 렌더링하지 않습니다) */}
      <main
        style={{
          flex: 1, // 기존 값 유지
          padding: 20, // 기존 값 유지
          backgroundColor: "#2c2f4a", // ✅ 메인 컨텐츠 배경색: 어두운 네이비 (원본 유지)
          textAlign: "center", // 기존 값 유지
          display: "flex", // 기존 값 유지
          justifyContent: "center", // 기존 값 유지
          alignItems: "center", // 기존 값 유지
          color: "#e0e0ff", // ✅ 텍스트 색상: 밝게 (원본 유지)
        }}
      >
        <h2 style={{ color: "#A8E6CF" }}>원하는 메뉴를 선택해주세요!</h2>{" "}
        {/* ✅ h2 태그 색상 변경 (원본 유지) */}
      </main>

      {/* 푸터 컴포넌트 */}
      <Footer userData={userData} onLogout={onLogout} isLoggedIn={isLoggedIn} />
    </div>
  );
}

export default MainPage;
