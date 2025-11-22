// src/components/common/Header.jsx (단 한 글자도 생략 없이, 전체를 대체하세요!)

import React from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate 훅 임포트

// Header 컴포넌트 정의
// userData: 사용자 정보 객체
// onLogout: 로그아웃 처리 함수 (App.js에서 전달됨)
// isLoggedIn: 로그인 상태 (App.js에서 전달됨)
// onShowLogin: (이전 모달 방식에서 사용) 이제 로그인 페이지로 navigate하므로 필요 없음.
function Header({ userData, onLogout, isLoggedIn }) {
  const navigate = useNavigate(); // 페이지 이동을 위한 useNavigate 훅 사용

  // handleLogoutClick 함수: 로그아웃 버튼 클릭 시 호출
  const handleLogoutClick = () => {
    onLogout(); // App.js의 handleLogout 함수 호출 (로그아웃 처리)
    navigate('/auth/login'); // 로그아웃 후 로그인 페이지로 리다이렉트
  };

  // handleLoginSignupClick 함수: 로그인/회원가입 버튼 클릭 시 호출
  const handleLoginSignupClick = () => {
    navigate('/auth/login'); // 로그인 페이지로 이동 (LoginSignup 컴포넌트가 라우트에 연결됨)
  };

  return (
    <header style={{
      display: 'flex', // flexbox 레이아웃 사용
      justifyContent: 'space-between', // 요소를 양 끝으로 배치
      alignItems: 'center', // 세로 중앙 정렬
      padding: '15px 30px', // 내부 여백
      backgroundColor: '#f8f9fa', // 배경색
      borderBottom: '1px solid #e9ecef', // 하단 테두리
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)', // 그림자 효과
      fontFamily: 'Arial, sans-serif' // 폰트
    }}>
      {/* 왼쪽 여백을 위한 빈 div. flex-grow로 남은 공간 차지하여 중앙 요소의 균형을 맞춥니다. */}
      <div style={{ flex: 1 }}></div>

      {/* 홈페이지 제목: flex:1로 남은 공간 차지하며 가운데 정렬. Link 컴포넌트로 클릭 시 루트 경로로 이동 */}
      <div style={{ flex: 1, textAlign: 'center', fontSize: '1.8em', fontWeight: 'bold', color: '#007bff' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          ✨ 광고 매니저 ✨
        </Link>
      </div>

      {/* 오른쪽 로그인/로그아웃 버튼 네비게이션 영역 */}
      <nav style={{ flex: 1, textAlign: 'right' }}> {/* flex:1로 남은 공간 차지하여 오른쪽 정렬 */}
        {isLoggedIn ? ( // 로그인 상태이면 (true)
          <>
            {/* 환영 메시지 */}
            <span style={{ fontSize: '1.0em', color: '#555', alignSelf: 'center', marginRight: '15px' }}>
              환영합니다, <strong>{userData?.email?.split('@')[0]}</strong>님! {/* 이메일 앞부분만 표시 */}
            </span>
            {/* 로그아웃 버튼 */}
            <button onClick={handleLogoutClick} style={{
              background: '#dc3545', // 배경색 빨간색
              border: 'none', // 테두리 없음
              color: 'white', // 글자색 흰색
              cursor: 'pointer', // 마우스 오버 시 포인터 변경
              fontSize: '1.0em', // 글자 크기
              fontWeight: 'bold', // 글자 굵게
              padding: '8px 15px', // 내부 여백
              borderRadius: '5px' // 모서리 둥글게
            }}>
              로그아웃
            </button>
          </>
        ) : ( // 로그인 상태가 아니면 (false)
          // 로그인/회원가입 버튼
          <button
            onClick={handleLoginSignupClick} // 로그인 페이지로 이동 함수 호출
            style={{
              background: '#007bff', // 배경색 파란색
              border: 'none', // 테두리 없음
              color: 'white', // 글자색 흰색
              cursor: 'pointer', // 마우스 오버 시 포인터 변경
              fontSize: '1.0em', // 글자 크기
              fontWeight: 'bold', // 글자 굵게
              padding: '8px 15px', // 내부 여백
              borderRadius: '5px' // 모서리 둥글게
            }}>
            로그인 / 회원가입
          </button>
        )}
      </nav>
    </header>
  );
}

export default Header;