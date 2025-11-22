// src/AdWaitingModal.jsx

import React from 'react';

function AdWaitingModal({ isOpen, onClose }) {
  if (!isOpen) return null; // isOpen이 false면 아무것도 렌더링하지 않음

  return (
    <div style={{
      position: 'fixed', // 화면 전체를 덮도록 고정
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', // 반투명 검은색 배경 (오버레이)
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000 // 다른 요소들 위에 표시되도록 z-index 설정
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '30px 40px',
        borderRadius: '10px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* 로딩 스피너 (간단한 CSS로 구현) */}
        <div style={{
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #3498db',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          animation: 'spin 1s linear infinite' // CSS 애니메이션
        }}></div>
        <p style={{
          fontSize: '1.2em',
          color: '#333',
          fontWeight: 'bold',
          margin: 0
        }}>
          광고를 준비 중입니다... 잠시만 기다려 주세요!
        </p>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          (이 창은 3초 후에 자동으로 닫힙니다.)
        </p>
        {/* CSS 애니메이션 정의 (JavaScript에서 직접 스타일로 넣을 수 없음, Global CSS에 추가해야 함) */}
        {/* 실제 프로젝트에서는 index.css 또는 App.css 같은 곳에 아래 CSS를 추가해야 함 */}
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        {/* 테스트를 위해 닫기 버튼을 추가했지만, 실제로는 자동 닫힘 */}
        {/* <button onClick={onClose} style={{
          marginTop: '15px',
          padding: '8px 15px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}>
          닫기
        </button> */}
      </div>
    </div>
  );
}

export default AdWaitingModal;