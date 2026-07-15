import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    window.location.replace('/test_community/login');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <p>Kjobs로 이동 중...</p>
      </div>
    </div>
  );
}
