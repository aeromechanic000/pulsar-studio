import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/useAppStore';
import { ChatIcon, LightningIcon, PlusIcon, BriefcaseIcon, SettingsIcon, BookIcon, BrainIcon, TargetIcon, GearIcon } from '../components/Icons';
import { invoke } from '@tauri-apps/api/tauri';
import ThreadConfigModal from '../components/ThreadConfigModal';
import { ThreadConfig } from '../types';

const WorkingPage: React.FC = () => {
  const { t } = useTranslation();

  const { selected_thread_id, threads, agentAsk, is_loading, createThread, showThreadModal, setShowThreadModal, setStatusMessage } = useAppStore();
  const [request, setRequest] = useState('');
  const [executionMode, setExecutionMode] = useState<'interactive' | 'auto'>('interactive');

  const selectedThread = threads.find(t => t.id === selected_thread_id);

  const handleCreateThreadClick = () => {
    // Set status message to track the click
    setStatusMessage('Create Thread button clicked! Opening configuration...');

    // Open the modal
    setShowThreadModal(true);

    // Clear status message after 3 seconds
    setTimeout(() => setStatusMessage(undefined), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected_thread_id || !request.trim()) return;

    try {
      await agentAsk({
        thread_id: selected_thread_id,
        text: request.trim(),
        files: [],
        execution_mode: executionMode,
      });
      setRequest('');
    } catch (error) {
      console.error('Failed to submit request:', error);
    }
  };

  const handleCreateThread = async (config: ThreadConfig & { name: string; workingDirectory: string }) => {
    try {
      await createThread({
        name: config.name,
        working_dir: config.workingDirectory,
        plannerLlmAlias: config.plannerLlmAlias,
        deciderLlmAlias: config.deciderLlmAlias,
        selectedKnowledge: config.selectedKnowledge,
        selectedGuides: config.selectedGuides,
        selectedActions: config.selectedActions,
        config: {
          plannerLlmAlias: config.plannerLlmAlias,
          deciderLlmAlias: config.deciderLlmAlias,
          selectedKnowledge: config.selectedKnowledge,
          selectedGuides: config.selectedGuides,
          selectedActions: config.selectedActions,
        },
      });
      setShowThreadModal(false);
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  };

  if (!selectedThread) {
    return (
      <div style={{
        height: '100%',
        background: 'linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* ThreadConfigModal */}
        <ThreadConfigModal
          isOpen={showThreadModal}
          onClose={() => setShowThreadModal(false)}
          onSave={handleCreateThread}
        />
        {/* Subtle background pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle at 25% 25%, var(--color-accent) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, var(--color-success) 0%, transparent 50%)`,
          pointerEvents: 'none'
        }} />

        <div style={{
          textAlign: 'center',
          maxWidth: '480px',
          padding: 'var(--spacing-3xl)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
            <div style={{
              width: '120px',
              height: '120px',
              margin: '0 auto var(--spacing-xl)',
              background: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
              boxShadow: 'var(--shadow-xl)',
              transition: 'transform 300ms ease',
            }}>
              <img src="/icons/icon.png" alt="Pulsar Studio" style={{ width: '96px', height: '96px' }} />
            </div>
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 var(--spacing-md) 0',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px'
          }}>
            {t('workingPage.welcome')}
          </h1>

          <p style={{
            fontSize: '18px',
            color: 'var(--color-text-secondary)',
            margin: '0 0 var(--spacing-2xl) 0',
            lineHeight: '1.6',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {t('workingPage.welcomeSubtitle')}
          </p>

          <div className="card card-elevated" style={{
            marginBottom: 'var(--spacing-xl)',
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-elevated)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-content text-center">
              <div style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-accent)' }}>
                <PlusIcon size={40} />
              </div>
              <h3 style={{
                margin: '0 0 var(--spacing-md) 0',
                fontSize: '20px',
                fontWeight: '600',
                color: 'var(--color-text-primary)'
              }}>
                {t('workingPage.createFirstThread')}
              </h3>
              <p style={{
                margin: '0 0 var(--spacing-xl) 0',
                fontSize: '16px',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5'
              }}>
                {t('workingPage.createThreadDescription')}
              </p>
              <button
              onClick={handleCreateThreadClick}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                margin: '0 auto',
                padding: 'var(--spacing-md) var(--spacing-xl)',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                transition: 'all var(--transition-normal)'
              }}
            >
              + Create New Thread
            </button>

              <p className="card-description" style={{
                marginTop: 'var(--spacing-lg)',
                fontSize: '14px'
              }}>
                💡 Tip: You can also use the <strong>+ New</strong> button in the sidebar
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-column" style={{ background: 'var(--color-bg-primary)' }}>
      {/* ThreadConfigModal */}
      <ThreadConfigModal
        isOpen={showThreadModal}
        onClose={() => setShowThreadModal(false)}
        onSave={handleCreateThread}
      />
      {/* Header */}
      <div
        style={{
          background: 'var(--color-bg-elevated)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--spacing-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Title Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)'
        }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            margin: 0,
            color: 'var(--color-text-primary)'
          }}>
            {selectedThread.name}
          </h2>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)'
          }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Mode</label>
              <select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as 'interactive' | 'auto')}
                className="custom-select"
                style={{
                  maxWidth: '120px',
                  fontSize: '13px',
                  padding: 'var(--spacing-xs) var(--spacing-sm)'
                }}
              >
                <option value="interactive">Interactive</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Thread Configuration Display */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-md)',
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)'
        }}>
          {/* Planner LLM Configuration */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <SettingsIcon size={12} />
              Planner LLM
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontWeight: '500'
            }}>
              {selectedThread.config?.plannerLlmAlias || 'Default'}
            </div>
          </div>

          {/* Decider LLM Configuration */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <SettingsIcon size={12} />
              Decider LLM
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontWeight: '500'
            }}>
              {selectedThread.config?.deciderLlmAlias || 'Default'}
            </div>
          </div>

          {/* Working Directory */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <BriefcaseIcon size={12} />
              Working Directory
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {selectedThread.working_dir}
            </div>
          </div>

          {/* Knowledge Sources */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <BrainIcon size={12} />
              Knowledge
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)'
            }}>
              {selectedThread.config?.selectedKnowledge.length || 0} sources
            </div>
          </div>

          {/* Planning Guides */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <BookIcon size={12} />
              Guides
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)'
            }}>
              {selectedThread.config?.selectedGuides.length || 0} guides
            </div>
          </div>

          {/* Available Actions */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <TargetIcon size={12} />
              Actions
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-primary)'
            }}>
              {selectedThread.config?.selectedActions.length || 0} actions
            </div>
          </div>
        </div>
      </div>

      {/* Chat interface */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)'
      }}>
        {/* Messages area - scrollable */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div className="text-center" style={{
            padding: 'var(--spacing-2xl) var(--spacing-lg)',
            color: 'var(--color-text-tertiary)'
          }}>
            <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-tertiary)' }}>
              <ChatIcon size={48} />
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '500',
              margin: '0 var(--spacing-sm) var(--spacing-md)',
              color: 'var(--color-text-secondary)'
            }}>
              Ready for your first request
            </h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              Start a conversation with your AI agent by typing a request below. You can ask questions, provide tasks, or request assistance with your projects.
            </p>
            <div className="card card-elevated" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div className="card-content">
                <div className="text-center" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)'
                  }}>
                    <LightningIcon size={12} />
                    <span>Tip</span>
                  </div>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: 'var(--color-text-tertiary)'
                }}>
                  Be specific about what you want to accomplish. The more detailed your request, the better the agent can help you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Input form - always at bottom */}
        <div style={{
          background: 'var(--color-bg-secondary)',
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--spacing-lg)',
          flexShrink: 0,
          borderBottomLeftRadius: 'var(--radius-lg)',
          borderBottomRightRadius: 'var(--radius-lg)',
          margin: '0 var(--spacing-lg) var(--spacing-lg)'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder={t('workingPage.chat.placeholder')}
                className="input"
                disabled={is_loading}
                style={{
                  fontSize: '15px',
                  padding: 'var(--spacing-md)',
                  paddingRight: 'var(--spacing-2xl)',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)'
                }}
              />
              <div style={{
                position: 'absolute',
                right: 'var(--spacing-md)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-tertiary)',
                fontSize: '20px'
              }}>
                <LightningIcon size={20} />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={is_loading || !request.trim()}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                fontSize: '15px',
                fontWeight: '600',
                borderRadius: 'var(--radius-lg)',
                minWidth: '100px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {is_loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <GearIcon size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Processing...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <span>Send</span>
                  <ChatIcon size={16} />
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Thread Configuration Modal */}
      <ThreadConfigModal
        isOpen={showThreadModal}
        onClose={() => setShowThreadModal(false)}
        onSave={handleCreateThread}
      />
    </div>
  );
};

export default WorkingPage;