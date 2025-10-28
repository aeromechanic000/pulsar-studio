import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/useAppStore';

interface LLMInstance {
  id?: string;
  name: string;
  provider: 'openai_compatible' | 'ollama';
  base_url: string;
  model: string;
  api_key?: string;
  temperature: number;
  max_tokens?: number;
  think: boolean;
  alias: string;
}

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useAppStore();

  const [instances, setInstances] = useState<LLMInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingInstance, setTestingInstance] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newInstance, setNewInstance] = useState<Partial<LLMInstance>>({
    name: '',
    provider: 'openai_compatible',
    base_url: '',
    model: '',
    temperature: 0.7,
    max_tokens: 4000,
    think: false,
    alias: ''
  });

  // Instance templates
  const instanceTemplates = [
    {
      name: 'OpenAI GPT-4',
      template: {
        name: 'OpenAI GPT-4',
        provider: 'openai_compatible' as const,
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4000,
        think: false,
        alias: 'openai-gpt4'
      }
    },
    {
      name: 'OpenAI GPT-3.5 Turbo',
      template: {
        name: 'OpenAI GPT-3.5 Turbo',
        provider: 'openai_compatible' as const,
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 4000,
        think: false,
        alias: 'openai-gpt35'
      }
    },
    {
      name: 'Local Ollama (Llama 3.2 3B)',
      template: {
        name: 'Local Ollama (Llama 3.2 3B)',
        provider: 'ollama' as const,
        base_url: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.5,
        max_tokens: 2000,
        think: true,
        alias: 'local-llama32'
      }
    },
    {
      name: 'Anthropic Claude (via proxy)',
      template: {
        name: 'Anthropic Claude (via proxy)',
        provider: 'openai_compatible' as const,
        base_url: 'https://api.anthropic-proxy.com/v1',
        model: 'claude-3-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4000,
        think: true,
        alias: 'claude-sonnet'
      }
    },
    {
      name: 'Google Gemini (via proxy)',
      template: {
        name: 'Google Gemini (via proxy)',
        provider: 'openai_compatible' as const,
        base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-pro',
        temperature: 0.7,
        max_tokens: 4000,
        think: false,
        alias: 'gemini-pro'
      }
    }
  ];

  // Load instances on component mount
  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      console.log('Loading LLM instances...');
      setLoading(true);
      const loadedInstances = await invoke<LLMInstance[]>('get_all_llm_providers');
      console.log('Loaded instances:', loadedInstances);
      setInstances(loadedInstances);
      setError(null);
    } catch (err) {
      console.error('Failed to load instances:', err);
      setError(`Failed to load LLM instances: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const validateInstance = (instance: Partial<LLMInstance>): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!instance.name || instance.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (!instance.alias || instance.alias.trim() === '') {
      newErrors.alias = 'Alias is required';
    }

    if (!instance.base_url || instance.base_url.trim() === '') {
      newErrors.base_url = 'Base URL is required';
    } else {
      try {
        new URL(instance.base_url);
      } catch {
        newErrors.base_url = 'Invalid URL format';
      }
    }

    if (!instance.model || instance.model.trim() === '') {
      newErrors.model = 'Model is required';
    }

    if (instance.temperature !== undefined && (instance.temperature < 0 || instance.temperature > 2)) {
      newErrors.temperature = 'Temperature must be between 0 and 2';
    }

    if (instance.max_tokens !== undefined && instance.max_tokens !== undefined && instance.max_tokens <= 0) {
      newErrors.max_tokens = 'Max tokens must be greater than 0';
    }

    if (instance.provider === 'openai_compatible' && (!instance.api_key || instance.api_key.trim() === '')) {
      newErrors.api_key = 'API key is required for OpenAI compatible instances';
    }

    return newErrors;
  };

  const addInstance = async () => {
    const validationErrors = validateInstance(newInstance);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        const instance: LLMInstance = {
          name: newInstance.name!,
          alias: newInstance.alias!,
          provider: newInstance.provider || 'openai_compatible',
          base_url: newInstance.base_url!,
          model: newInstance.model!,
          temperature: newInstance.temperature || 0.7,
          max_tokens: newInstance.max_tokens,
          think: newInstance.think || false,
          api_key: newInstance.api_key
        };

        console.log('Adding instance:', instance);
        await invoke('add_llm_provider', { provider: instance });
        console.log('Instance added successfully');
        await loadInstances(); // Reload the list

        // Reset form
        setNewInstance({
          name: '',
          provider: 'openai_compatible',
          base_url: '',
          model: '',
          temperature: 0.7,
          max_tokens: 4000,
          think: false,
          alias: ''
        });
        setShowAddForm(false);
        setErrors({});
      } catch (err) {
        console.error('Failed to add instance:', err);
        setError(`Failed to add LLM instance: ${err}`);
      }
    }
  };

  const deleteInstance = async (id: string) => {
    if (confirm('Are you sure you want to delete this instance?')) {
      try {
        await invoke('delete_llm_provider', { id });
        await loadInstances(); // Reload the list
      } catch (err) {
        console.error('Failed to delete instance:', err);
        setError('Failed to delete LLM instance');
      }
    }
  };

  const startEditInstance = (instance: LLMInstance) => {
    setEditingInstance(instance.alias);
    setNewInstance({
      name: instance.name,
      alias: instance.alias,
      provider: instance.provider,
      base_url: instance.base_url,
      model: instance.model,
      api_key: instance.api_key || '',
      temperature: instance.temperature,
      max_tokens: instance.max_tokens,
      think: instance.think
    });
    setShowAddForm(true);
    setErrors({});
    setError('');
  };

  const updateInstance = async () => {
    if (!editingInstance) return;

    const validationErrors = validateInstance(newInstance);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        const instance: LLMInstance = {
          name: newInstance.name!,
          alias: newInstance.alias!,
          provider: newInstance.provider || 'openai_compatible',
          base_url: newInstance.base_url!,
          model: newInstance.model!,
          temperature: newInstance.temperature || 0.7,
          max_tokens: newInstance.max_tokens,
          think: newInstance.think || false,
          api_key: newInstance.api_key
        };

        await invoke('update_llm_provider', { id: editingInstance, provider: instance });
        await loadInstances();
        setEditingInstance(null);
        setShowAddForm(false);
        setNewInstance({
          name: '',
          provider: 'openai_compatible',
          base_url: '',
          model: '',
          temperature: 0.7,
          max_tokens: 4000,
          think: false,
          alias: ''
        });
        setErrors({});
      } catch (err) {
        console.error('Failed to update instance:', err);
        setError('Failed to update LLM instance');
      }
    }
  };

  const testInstance = async (instance: LLMInstance) => {
    setTestingInstance(instance.alias);
    try {
      console.log('Testing instance:', instance);
      const result = await invoke('test_llm_provider', { provider: instance });
      setTestResults(prev => ({ ...prev, [instance.alias]: result }));
    } catch (err) {
      console.error('Failed to test instance:', err);
      setTestResults(prev => ({
        ...prev,
        [instance.alias]: {
          success: false,
          error: err
        }
      }));
    } finally {
      setTestingInstance(null);
    }
  };

  const applyTemplate = (template: any) => {
    setNewInstance(template.template);
    setEditingInstance(null);
    setShowAddForm(true);
    setErrors({});
  };

  const exportInstances = async () => {
    try {
      console.log('Exporting instances...');
      const exportData = await invoke<string>('export_providers');

      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pulsar-studio-instances-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Instances exported successfully');
    } catch (err) {
      console.error('Failed to export instances:', err);
      setError(`Failed to export instances: ${err}`);
    }
  };

  const importInstances = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          try {
            console.log('Importing instances...');
            const importedCount = await invoke<number>('import_providers', { providersJson: text });
            console.log(`Imported ${importedCount} instances`);
            await loadInstances(); // Reload the list
            setError(`Successfully imported ${importedCount} instances`);
          } catch (err) {
            console.error('Failed to import instances:', err);
            setError(`Failed to import instances: ${err}`);
          }
        }
      };
      input.click();
    } catch (err) {
      console.error('Failed to import instances:', err);
      setError(`Failed to import instances: ${err}`);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--color-text-secondary)'
      }}>
        {t('ui.loadingInstances')}
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)', fontSize: '28px', fontWeight: '700' }}>
            {t('settings.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            Configure LLM instances and application settings
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '32px',
            color: 'var(--color-error)'
          }}>
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '16px',
                padding: '4px 8px',
                backgroundColor: 'var(--color-error)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Appearance & Language Section */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: '600' }}>
              {t('settings.appearance.title')}
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {/* Language Setting */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-secondary)',
                marginBottom: '8px'
              }}>
                {t('settings.appearance.language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: 'pointer'
                }}
              >
                <option value="en">{t('settings.appearance.languageOptions.en')}</option>
                <option value="zh">{t('settings.appearance.languageOptions.zh')}</option>
              </select>
            </div>

            {/* Theme Setting */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-secondary)',
                marginBottom: '8px'
              }}>
                {t('settings.appearance.theme')}
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: 'pointer'
                }}
              >
                <option value="light">{t('settings.appearance.themeOptions.light')}</option>
                <option value="dark">{t('settings.appearance.themeOptions.dark')}</option>
                <option value="system">{t('settings.appearance.themeOptions.system')}</option>
              </select>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-text-tertiary)'
          }}>
            {t(`ui.themeDescriptions.${theme}`)}
          </div>
        </div>

        {/* LLM Instances Section */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: '600' }}>
              {t('settings.llm.title')}
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={importInstances}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                📥 Import
              </button>
              <button
                onClick={exportInstances}
                disabled={instances.length === 0}
                style={{
                  padding: '10px 16px',
                  backgroundColor: instances.length === 0 ? 'var(--color-bg-secondary)' : 'var(--color-bg-elevated)',
                  color: instances.length === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: instances.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseOver={(e) => {
                  if (instances.length > 0) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = instances.length === 0 ? 'var(--color-bg-secondary)' : 'var(--color-bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                📤 Export
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'all 150ms ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                }}
              >
                + Add New Instance
              </button>
            </div>
          </div>

          {/* Quick Templates */}
          <div style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '32px'
          }}>
            <h4 style={{ margin: '0 0 20px 0', color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: '600' }}>
              🚀 Quick Templates
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {instanceTemplates.map((template) => (
                <button
                  key={template.name}
                  onClick={() => applyTemplate(template)}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 150ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                    {template.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {template.template.provider === 'ollama' ? '🏠 Local' : '☁️ Cloud'} • {template.template.model}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Alias: <code style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '3px' }}>{template.template.alias}</code>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Add/Edit Instance Form */}
          {showAddForm && (
            <div style={{
              backgroundColor: 'var(--color-primary-bg)',
              border: '2px solid var(--color-primary)',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingInstance ? '✏️ EDITING' : '➕ NEW INSTANCE'}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--color-primary-dark)', fontSize: '14px' }}>
                    {editingInstance ? 'Edit LLM Instance' : 'Add New LLM Instance'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingInstance(null);
                    setErrors({});
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Instance Name *
                  </label>
                  <input
                    type="text"
                    value={newInstance.name || ''}
                    onChange={(e) => setNewInstance({...newInstance, name: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="e.g., OpenAI GPT-4"
                  />
                  {errors.name && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.name}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Alias *
                  </label>
                  <input
                    type="text"
                    value={newInstance.alias || ''}
                    onChange={(e) => setNewInstance({...newInstance, alias: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="e.g., gpt-4"
                  />
                  {errors.alias && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.alias}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Provider Type *
                  </label>
                  <select
                    value={newInstance.provider}
                    onChange={(e) => setNewInstance({...newInstance, provider: e.target.value as 'openai_compatible' | 'ollama'})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="openai_compatible">OpenAI (OpenAI Compatible)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Base URL *
                  </label>
                  <input
                    type="url"
                    value={newInstance.base_url || ''}
                    onChange={(e) => setNewInstance({...newInstance, base_url: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="https://api.openai.com/v1"
                  />
                  {errors.base_url && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.base_url}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Model *
                  </label>
                  <input
                    type="text"
                    value={newInstance.model || ''}
                    onChange={(e) => setNewInstance({...newInstance, model: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="gpt-4"
                  />
                  {errors.model && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.model}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Temperature (0-2)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={newInstance.temperature || ''}
                    onChange={(e) => setNewInstance({...newInstance, temperature: parseFloat(e.target.value)})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="0.7"
                  />
                  {errors.temperature && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.temperature}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                    Max Tokens (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newInstance.max_tokens || ''}
                    onChange={(e) => setNewInstance({...newInstance, max_tokens: parseInt(e.target.value)})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="4000"
                  />
                  {errors.max_tokens && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.max_tokens}</div>}
                </div>

                {newInstance.provider === 'openai_compatible' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                      API Key *
                    </label>
                    <input
                      type="password"
                      value={newInstance.api_key || ''}
                      onChange={(e) => setNewInstance({...newInstance, api_key: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: 'var(--color-bg-elevated)',
                        boxSizing: 'border-box'
                      }}
                      placeholder="sk-..."
                    />
                    {errors.api_key && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>{errors.api_key}</div>}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="think"
                    checked={newInstance.think || false}
                    onChange={(e) => setNewInstance({...newInstance, think: e.target.checked})}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--color-primary)'
                    }}
                  />
                  <label htmlFor="think" style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}>
                    Enable Think Mode (Chain of Thought)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingInstance(null);
                    setErrors({});
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={editingInstance ? updateInstance : addInstance}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                  }}
                >
                  {editingInstance ? t('common.edit') : t('settings.llm.addInstance')}
                </button>
              </div>
            </div>
          )}

          {/* Instances List */}
          {instances.map((instance) => (
            <div key={instance.alias} style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <div>
                  <h4 style={{
                    margin: '0 0 8px 0',
                    color: 'var(--color-text-primary)',
                    fontSize: '18px',
                    fontWeight: '600'
                  }}>
                    {instance.name} ({instance.alias})
                  </h4>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    backgroundColor: instance.provider === 'ollama' ? 'var(--color-success-bg)' : 'var(--color-primary-bg)',
                    color: instance.provider === 'ollama' ? 'var(--color-success)' : 'var(--color-primary)',
                    border: `1px solid ${instance.provider === 'ollama' ? 'var(--color-success-border)' : 'var(--color-primary-border)'}`,
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    marginBottom: '12px'
                  }}>
                    {instance.provider === 'ollama' ? '🏠 Ollama (Local)' : '☁️ OpenAI Compatible'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => startEditInstance(instance)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => deleteInstance(instance.alias)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-error)',
                      border: '1px solid var(--color-error)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-error)';
                      e.currentTarget.style.color = 'var(--color-text-inverse)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                      e.currentTarget.style.color = 'var(--color-error)';
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
                fontSize: '14px',
                color: 'var(--color-text-secondary)'
              }}>
                <div><strong>Model:</strong> {instance.model}</div>
                <div><strong>URL:</strong> {instance.base_url}</div>
                <div><strong>Temperature:</strong> {instance.temperature}</div>
                <div><strong>Max Tokens:</strong> {instance.max_tokens || 'Not set'}</div>
                {instance.think && <div><strong>Think Mode:</strong> ✅ Enabled</div>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {instance.api_key ? '🔐 API Key configured' : '⚠️ No API Key'}
                </div>
                <button
                  onClick={() => testInstance(instance)}
                  disabled={testingInstance === instance.alias}
                  style={{
                    padding: '8px 16px',
                    border: testingInstance === instance.alias ? '1px solid var(--color-text-tertiary)' : '1px solid var(--color-success)',
                    backgroundColor: testingInstance === instance.alias ? 'var(--color-bg-secondary)' : 'var(--color-bg-elevated)',
                    color: testingInstance === instance.alias ? 'var(--color-text-tertiary)' : 'var(--color-success)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: testingInstance === instance.alias ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 150ms ease'
                  }}
                >
                  {testingInstance === instance.alias ? (
                    <>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        border: '2px solid var(--color-text-tertiary)',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      🔗 Test Connection
                    </>
                  )}
                </button>
              </div>

              {testResults[instance.alias] && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: testResults[instance.alias].success ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                  border: `1px solid ${testResults[instance.alias].success ? 'var(--color-success)' : 'var(--color-error)'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: testResults[instance.alias].success ? 'var(--color-success)' : 'var(--color-error-dark)'
                }}>
                  {testResults[instance.alias].success ? (
                    <>
                      ✅ <strong>Connection successful!</strong> Response time: {testResults[instance.alias].response_time_ms}ms
                    </>
                  ) : (
                    <>
                      ❌ <strong>Connection failed:</strong> {testResults[instance.alias].error || 'Test failed'}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {instances.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '2px dashed var(--color-border)',
              borderRadius: '12px',
              color: 'var(--color-text-secondary)'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                opacity: 0.5
              }}>
                🤖
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontSize: '20px' }}>
                {t('ui.noInstancesYet')}
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '16px', color: 'var(--color-text-secondary)' }}>
                {t('ui.addFirstInstance')}
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '14px 28px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                  transition: 'all 150ms ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                }}
              >
                🚀 Add Your First Instance
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;