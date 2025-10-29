import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BriefcaseIcon, GearIcon, BookIcon, BrainIcon, TargetIcon } from './Icons';
import { useAppStore } from '../stores/useAppStore';

// Sidebar connected to real store - buttons should work now
const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    threads,
    selected_thread_id,
    sidebar_collapsed,
    setCurrentPage,
    selectThread,
    toggleSidebar,
    setShowThreadModal,
    setStatusMessage

  } = useAppStore();

  const handleCreateThreadClicked = () => {
    setStatusMessage('Create Thread.');
    console.log('Sidebar Create Thread button clicked!');
    if (location.pathname === '/') {
      setShowThreadModal(true);
    } else {
      navigate('/');
      setTimeout(() => setShowThreadModal(true), 300);
    }
    setTimeout(() => setStatusMessage("Ready to create a new thread."), 3000);
  };

  const navItems = [
    { path: '/', label: t('sidebar.working'), icon: BriefcaseIcon },
    { path: '/settings', label: t('sidebar.settings'), icon: GearIcon },
    { path: '/guides', label: t('sidebar.guides'), icon: BookIcon },
    { path: '/knowledge', label: t('sidebar.knowledge'), icon: BrainIcon },
    { path: '/actions', label: t('sidebar.actions'), icon: TargetIcon },
  ];

  return (
    <aside
      style={{
        width: sidebar_collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: 'var(--color-bg-primary)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 300ms ease-in-out'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
          minHeight: 'var(--header-height)',
          background: 'var(--color-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Title - only shown when not collapsed */}
        {!sidebar_collapsed && (
          <h1
            style={{
              margin: 0,
              color: 'var(--color-text-primary)',
              fontSize: '18px',
              fontWeight: '600',
              flex: 1,
              textAlign: 'center'
            }}
          >
            {t('app.title')}
          </h1>
        )}

        {/* Toggle button - always visible and aligned with title */}
        <button
          onClick={toggleSidebar}
          className="btn btn-icon btn-ghost"
          title={sidebar_collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: sidebar_collapsed ? 'auto' : 0
          }}
        >
          {sidebar_collapsed ? (
            <span style={{ fontSize: '20px' }}>▶</span>
          ) : (
            <span style={{ fontSize: '20px' }}>◀</span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ padding: 'var(--spacing-sm)' }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              btn btn-ghost btn-icon-text w-full text-left
              ${location.pathname === item.path ? 'active' : ''}
            `}
            title={sidebar_collapsed ? item.label : undefined}
            style={{
              justifyContent: sidebar_collapsed ? 'center' : 'flex-start',
              marginBottom: 'var(--spacing-xs)',
              padding: sidebar_collapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
            }}
          >
            <item.icon
              size={20}
              style={{
                color: location.pathname === item.path ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                flexShrink: 0
              }}
            />
            {!sidebar_collapsed && (
              <span style={{
                fontWeight: '500',
                fontSize: '14px',
                color: location.pathname === item.path ? 'var(--color-accent)' : 'var(--color-text-primary)'
              }}>
                {item.label}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Thread List */}
      {!sidebar_collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-sm)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)'
            }}
          >
            <h3
              style={{
                margin: 0,
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600'
              }}
            >
              {t('sidebar.threads')}
            </h3>
            <button
              onClick={handleCreateThreadClicked}
              className="btn btn-sm btn-primary"
              title={t('sidebar.createNewThread')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: '12px',
                padding: 'var(--spacing-xs) var(--spacing-sm)'
              }}
            >
            {t('sidebar.newThread')}
            </button>
          </div>

          {threads.length === 0 ? (
            <div
              style={{
                padding: 'var(--spacing-2xl) var(--spacing-lg)',
                color: 'var(--color-text-tertiary)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-tertiary)' }}>
                📄
              </div>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {t('sidebar.noThreadsYet')}
              </p>
              <p style={{
                margin: 'var(--spacing-sm) 0 0',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                {t('sidebar.createFirstThread')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => {
                    selectThread(thread.id);
                    setCurrentPage('working');
                  }}
                  className={`
                    btn btn-ghost text-left w-full
                    ${selected_thread_id === thread.id ? 'active' : ''}
                  `}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 'var(--spacing-xs)',
                    flex: 1,
                    textAlign: 'left'
                  }}>
                    <div
                      style={{
                        fontWeight: '500',
                        fontSize: '14px',
                        color: selected_thread_id === thread.id ? 'var(--color-accent)' : 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                      }}
                    >
                      {thread.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-tertiary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        opacity: 0.8
                      }}
                    >
                      {thread.working_dir}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: 'var(--spacing-sm)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-elevated)'
        }}
      >
        {!sidebar_collapsed && (
          <div
            className="text-center"
            style={{
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
              fontWeight: '500'
            }}
          >
            Pulsar Studio v0.1.0
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;