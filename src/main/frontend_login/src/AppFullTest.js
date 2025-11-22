// src/AppFullTest.jsx
import React, { useState, useEffect } from 'react';
import LoginSignup from './components/LoginSignup/LoginSignup';
import MyPage from './components/MyPage/MyPage';
import TextGenerator from './TextGenerator';
import ImageGenerator from './ImageGenerator';
import FacebookInput from './FacebookInput';
import AdWaitingModal from './AdWaitingModal';
import MetaAdManager from './MetaAdManager';

function AppFullTest() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeComponent, setActiveComponent] = useState('text');
  const [selectedAdText, setSelectedAdText] = useState('');
  const [textGenParams, setTextGenParams] = useState(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);

  const handleLogin = (user) => {
    setIsLoggedIn(true);
    setUserData(user);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserData(null);
    setActiveComponent('text');
  };

  const handleAdTextSelect = (text, params) => {
    setSelectedAdText(text);
    setTextGenParams(params);
    setActiveComponent('image');
  };

  useEffect(() => {
    if (isAdModalOpen) {
      const timer = setTimeout(() => setIsAdModalOpen(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAdModalOpen]);

  if (!isLoggedIn) {
    return <LoginSignup onLogin={handleLogin} />;
  }

  return (
    <div className="App" style={appStyle}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button onClick={() => setActiveComponent('mypage')}>My Page</button>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div style={menuStyle}>
        <button onClick={() => setActiveComponent('text')} style={getButtonStyle(activeComponent === 'text', '#28a745')}>광고 문구 생성기</button>
        <button onClick={() => setActiveComponent('image')} style={getButtonStyle(activeComponent === 'image', '#007bff')}>이미지 합성기</button>
        <button onClick={() => setActiveComponent('facebook')} style={getButtonStyle(activeComponent === 'facebook', '#1877F2')}>페이스북 입력</button>
        <button onClick={() => setIsAdModalOpen(true)} style={getButtonStyle(false, '#ffc107')}>광고 대기창</button>
        <button onClick={() => setActiveComponent('metaAds')} style={getButtonStyle(activeComponent === 'metaAds', '#3b5998')}>메타 광고 관리</button>
      </div>

      {activeComponent === 'text' && <TextGenerator onTextSelect={handleAdTextSelect} />}
      {activeComponent === 'image' && <ImageGenerator selectedText={selectedAdText} textGenParams={textGenParams} />}
      {activeComponent === 'facebook' && <FacebookInput />}
      {activeComponent === 'metaAds' && <MetaAdManager />}
      {activeComponent === 'mypage' && <MyPage userData={userData} onLogout={handleLogout} />}

      <AdWaitingModal isOpen={isAdModalOpen} onClose={() => setIsAdModalOpen(false)} />
    </div>
  );
}

const appStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 20px',
  backgroundImage: 'url("/homepage_design.png")',
  backgroundSize: 'cover',
  backgroundBlendMode: 'overlay',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
};

const menuStyle = {
  marginBottom: '30px',
  textAlign: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: '20px',
  borderRadius: '15px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const getButtonStyle = (isActive, color) => ({
  padding: '10px 20px',
  backgroundColor: isActive ? color : '#e9ecef',
  color: isActive ? 'white' : '#495057',
  borderRadius: '8px',
  fontWeight: 'bold',
  border: 'none',
  cursor: 'pointer',
});

export default AppFullTest;
