import React from 'react';

function Footer() {
  return (
    <footer style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e9ecef',
      textAlign: 'center',
      marginTop: 'auto', // 페이지 하단에 붙도록 함
      fontFamily: 'Arial, sans-serif',
      fontSize: '0.9em',
      color: '#6c757d'
    }}>
      <p>&copy; 2025 광고 매니저. All rights reserved.</p>
      <p>연락처: support@admanager.com</p>
    </footer>
  );
}

export default Footer;