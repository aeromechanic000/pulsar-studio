import React from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main content area */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        <Sidebar />

        {/* Main content */}
        <main
          className="flex-1 overflow-auto"
          style={{
            background: 'var(--color-bg-primary)',
            flex: 1
          }}
        >
          {children}
        </main>

        {/* Right panel */}
        <aside
          style={{
            width: 'var(--right-panel-width)',
            background: 'var(--color-bg-secondary)',
            borderLeft: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Task description and plan progress */}
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('ui.taskAndPlan')}</h3>
              </div>
              <div className="card-content">
                <p className="text-secondary">{t('ui.noActiveTask')}</p>
                <p className="text-secondary" style={{ marginTop: 'var(--spacing-sm)' }}>
                  {t('ui.selectOrCreateThread')}
                </p>
              </div>
            </div>

            {/* Generated files */}
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div className="card-header">
                <h3 className="card-title">{t('ui.generatedFiles')}</h3>
              </div>
              <div className="card-content">
                <div className="text-center" style={{ padding: 'var(--spacing-xl) var(--spacing-md)' }}>
                  <div style={{ fontSize: '24px', marginBottom: 'var(--spacing-sm)' }}>📄</div>
                  <p className="text-secondary">{t('ui.noFilesGenerated')}</p>
                  <p className="card-description">
                    {t('ui.filesWillAppearHere')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default Layout;