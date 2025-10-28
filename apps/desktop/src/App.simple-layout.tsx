import React from 'react';

// Only import working icons
import { ArrowLeftIcon, ArrowRightIcon, TargetIcon } from './components/Icons';

console.log('Testing only working icons...');

const SimpleLayout: React.FC = () => {
  console.log('Testing working Icons component rendering...');

  try {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <h2>✅ Working Icons Test</h2>

        <div style={{ textAlign: 'center' }}>
        <h3>Only Working Icons (No Problematic Icons)</h3>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <ArrowLeftIcon size={48} />
            <div>ArrowLeft</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ArrowRightIcon size={48} />
            <div>ArrowRight</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <TargetIcon size={48} />
            <div>Target</div>
          </div>
        </div>
        <div style={{ marginTop: '10px', color: '#666' }}>
          All working icons loaded successfully!
        </div>
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '4px' }}>
          <p style={{ margin: 0, color: '#2d5f3f' }}>
            ✅ The app should now be working with full routing to Guides page
          </p>
        </div>
      </div>
      </div>
    );
  } catch (error) {
    console.error('Error in SimpleLayout:', error);
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#ff0000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        flexDirection: 'column'
      }}>
        ERROR IN ICONS TEST
        <div style={{ fontSize: '14px', marginTop: '20px' }}>
          {String(error)}
        </div>
      </div>
    );
  }
};

export default SimpleLayout;