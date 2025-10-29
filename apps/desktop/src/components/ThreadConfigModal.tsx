import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { useActionStore } from '../stores/useActionStore';
import { ThreadConfig, DirectoryPermissionResult } from '../types';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { SettingsIcon, BriefcaseIcon, BookIcon, BrainIcon, TargetIcon, XIcon } from './Icons';

interface ThreadConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ThreadConfig & { name: string; workingDirectory: string }) => Promise<void>;
  existingConfig?: ThreadConfig & { name: string; workingDirectory: string };
}

export const ThreadConfigModal: React.FC<ThreadConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingConfig
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { llm_configs, guides, knowledge } = useAppStore();
  const { getAvailableActions } = useActionStore();

  const [config, setConfig] = useState<ThreadConfig & { name: string; workingDirectory: string }>({
    name: '',
    plannerLlmAlias: '',
    deciderLlmAlias: '',
    workingDirectory: '',
    selectedKnowledge: [],
    selectedGuides: [],
    selectedActions: []
  });

  const [directoryValidation, setDirectoryValidation] = useState<DirectoryPermissionResult | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (existingConfig) {
      setConfig(existingConfig);
    } else {
      setConfig({
        name: `Thread ${Date.now()}`,
        plannerLlmAlias: llm_configs[0]?.alias || '',
        deciderLlmAlias: llm_configs[0]?.alias || '',
        workingDirectory: '/Users/nil/Projects',
        selectedKnowledge: [],
        selectedGuides: [],
        selectedActions: []
      });
    }
    setDirectoryValidation(null);
  }, [existingConfig, llm_configs]);

  const handleSave = async () => {
    if (!config.name || !config.plannerLlmAlias || !config.deciderLlmAlias) {
      alert(t('threadConfig.alerts.fillRequiredFields'));
      return;
    }

    if (!config.workingDirectory) {
      alert(t('threadConfig.alerts.selectWorkingDirectory'));
      return;
    }

    // Validate directory permissions
    if (!directoryValidation || !directoryValidation.writable) {
      alert(t('threadConfig.alerts.selectValidDirectory'));
      return;
    }

    setIsLoading(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save thread config:', error);
      alert(t('threadConfig.alerts.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('threadConfig.selectDirectory')
      });

      if (selected && typeof selected === 'string') {
        setConfig(prev => ({ ...prev, workingDirectory: selected }));

        // Validate directory permissions
        const validation = await invoke<DirectoryPermissionResult>('validate_directory_permissions', {
          path: selected
        });
        setDirectoryValidation(validation);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
      alert(t('threadConfig.alerts.directoryBrowseFailed'));
    }
  };

  const EmptyState: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    actionText: string;
    onAction?: () => void;
  }> = ({ title, description, icon, actionText, onAction }) => (
    <div style={{
      textAlign: 'center',
      padding: 'var(--spacing-2xl) var(--spacing-lg)',
      border: '2px dashed var(--color-border)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--color-bg-tertiary)',
      color: 'var(--color-text-tertiary)'
    }}>
      <div style={{ fontSize: '32px', marginBottom: 'var(--spacing-md)', opacity: 0.7 }}>
        {icon}
      </div>
      <h4 style={{
        margin: '0 0 var(--spacing-sm) 0',
        fontSize: '16px',
        fontWeight: '500',
        color: 'var(--color-text-secondary)'
      }}>
        {title}
      </h4>
      <p style={{
        margin: '0 0 var(--spacing-lg) 0',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        {description}
      </p>
      {onAction && (
        <button
          onClick={onAction}
          className="btn btn-ghost"
          style={{
            padding: 'var(--spacing-xs) var(--spacing-md)',
            fontSize: '13px'
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );

  const handleMultiSelect = (
    items: Array<{ id: string; name: string; description?: string }>,
    selected: string[],
    onChange: (selected: string[]) => void
  ) => {
    const toggleItem = (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter(item => item !== id));
      } else {
        onChange([...selected, id]);
      }
    };

    return (
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-sm)',
        maxHeight: '200px',
        overflow: 'auto'
      }}>
        {items.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-xs)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: selected.includes(item.id)
                ? 'var(--color-accent)'
                : 'transparent',
              color: selected.includes(item.id)
                ? 'white'
                : 'var(--color-text-primary)',
              marginBottom: 'var(--spacing-xs)'
            }}
            onClick={() => toggleItem(item.id)}
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => {}}
              style={{ margin: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', fontSize: '13px' }}>
                {item.name}
              </div>
              {item.description && (
                <div style={{
                  fontSize: '11px',
                  color: selected.includes(item.id)
                    ? 'rgba(255,255,255,0.8)'
                    : 'var(--color-text-tertiary)',
                  marginTop: '2px'
                }}>
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div
        className="thread-config-modal"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          width: '90%',
          scrollbarWidth: 'none',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: 'var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <SettingsIcon size={20} />
            {existingConfig ? t('threadConfig.editTitle') : t('threadConfig.createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>

            {/* Thread Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                {t('threadConfig.threadName')} *
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter a descriptive name for this thread"
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            {/* LLM Configuration - Planner */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                Planner LLM *
              </label>
              <select
                value={config.plannerLlmAlias}
                onChange={(e) => setConfig(prev => ({ ...prev, plannerLlmAlias: e.target.value }))}
                className="custom-select"
                style={{ width: '100%' }}
              >
                <option value="">Select an LLM for planning</option>
                {llm_configs.map((llm: any) => (
                  <option key={llm.alias} value={llm.alias}>
                    {llm.alias} ({llm.provider} - {llm.model})
                  </option>
                ))}
              </select>
              <div style={{
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                This LLM will be used for creating and updating plans
              </div>
            </div>

            {/* LLM Configuration - Decider */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                Decider LLM *
              </label>
              <select
                value={config.deciderLlmAlias}
                onChange={(e) => setConfig(prev => ({ ...prev, deciderLlmAlias: e.target.value }))}
                className="custom-select"
                style={{ width: '100%' }}
              >
                <option value="">Select an LLM for decision making</option>
                {llm_configs.map((llm: any) => (
                  <option key={llm.alias} value={llm.alias}>
                    {llm.alias} ({llm.provider} - {llm.model})
                  </option>
                ))}
              </select>
              <div style={{
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                marginTop: 'var(--spacing-xs)'
              }}>
                This LLM will be used for choosing next actions and decisions
              </div>
            </div>

            {/* Working Directory */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                Working Directory *
              </label>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <input
                  type="text"
                  value={config.workingDirectory}
                  onChange={(e) => setConfig(prev => ({ ...prev, workingDirectory: e.target.value }))}
                  placeholder="Enter the working directory path"
                  className="input"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleBrowseDirectory}
                  className="btn btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                >
                  <BriefcaseIcon size={16} />
                  Browse
                </button>
              </div>

              {/* Directory Validation Status */}
              {directoryValidation && (
                <div style={{
                  marginTop: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  backgroundColor: directoryValidation.writable
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                  color: directoryValidation.writable
                    ? 'var(--color-success)'
                    : 'var(--color-error)',
                  border: `1px solid ${
                    directoryValidation.writable
                      ? 'var(--color-success)'
                      : 'var(--color-error)'
                  }`
                }}>
                  {directoryValidation.writable ? (
                    <span>✅</span>
                  ) : (
                    <XIcon size={14} />
                  )}
                  <span>
                    {directoryValidation.writable
                      ? 'Directory is accessible with full permissions'
                      : directoryValidation.error || 'Directory validation failed'}
                  </span>
                </div>
              )}
            </div>

            {/* Knowledge Selection */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <BrainIcon size={16} />
                Knowledge Sources
              </label>
              {knowledge.length === 0 ? (
                <EmptyState
                  title="No Knowledge Sources Available"
                  description="Create knowledge entries in the Knowledge page to provide your agent with contextual information."
                  icon={<BrainIcon size={32} />}
                  actionText="Go to Knowledge"
                  onAction={() => {
                    // Close modal and navigate to knowledge page
                    onClose();
                    navigate('/knowledge');
                  }}
                />
              ) : (
                handleMultiSelect(
                  knowledge.map(k => ({
                    id: k.meta.name || 'unknown',
                    name: k.meta.name || 'Unnamed Knowledge File',
                    description: `${k.entries.length} knowledge entries • ${k.meta.domain || 'No domain'} • ${k.meta.version || 'No version'}`
                  })),
                  config.selectedKnowledge,
                  (selected) => setConfig(prev => ({ ...prev, selectedKnowledge: selected }))
                )
              )}
            </div>

            {/* Guides Selection */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <BookIcon size={16} />
                Planning Guides
              </label>
              {guides.length === 0 ? (
                <EmptyState
                  title="No Planning Guides Available"
                  description="Create planning guides in the Guides page to help your agent structure complex tasks effectively."
                  icon={<BookIcon size={32} />}
                  actionText="Go to Guides"
                  onAction={() => {
                    // Close modal and navigate to guides page
                    onClose();
                    navigate('/guides');
                  }}
                />
              ) : (
                handleMultiSelect(
                  guides.map(g => ({
                    id: g.meta.name || 'unknown',
                    name: g.meta.name || 'Unnamed Guide File',
                    description: `${g.entries.length} guide entries • ${g.meta.domain || 'No domain'} • ${g.meta.version || 'No version'}`
                  })),
                  config.selectedGuides,
                  (selected) => setConfig(prev => ({ ...prev, selectedGuides: selected }))
                )
              )}
            </div>

            {/* Actions Selection */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <TargetIcon size={16} />
                Available Actions
              </label>
              {(() => {
                const availableActions = getAvailableActions();
                return availableActions.length === 0 ? (
                  <EmptyState
                    title="No Actions Available"
                    description="Import action directories in the Actions page to provide your agent with executable capabilities."
                    icon={<TargetIcon size={32} />}
                    actionText="Go to Actions"
                    onAction={() => {
                      // Close modal and navigate to actions page
                      onClose();
                      navigate('/actions');
                    }}
                  />
                ) : (
                  handleMultiSelect(
                    availableActions.map(a => ({
                      id: a.spec.name,
                      name: a.spec.name,
                      description: a.spec.description || 'No description available'
                    })),
                    config.selectedActions,
                    (selected) => setConfig(prev => ({ ...prev, selectedActions: selected }))
                  )
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: 'var(--spacing-lg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            * Required fields
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={isLoading || !config.name || !config.plannerLlmAlias || !config.deciderLlmAlias || !directoryValidation?.writable}
            >
              {isLoading ? 'Saving...' : (existingConfig ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadConfigModal;