import React from 'react';

const SimpleApp: React.FC = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#333', margin: '0 0 20px 0' }}>Hello World</h1>
        <p style={{ color: '#666', margin: 0 }}>Pulsar Studio is running!</p>
      </div>
    </div>
  );
};

export default SimpleApp;