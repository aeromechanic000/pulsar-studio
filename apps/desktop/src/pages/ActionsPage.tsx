import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionStore, Action, ActionStatus } from '../stores/useActionStore';

const ActionsPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    actions,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    loadActions,
    importAction,
    deleteAction,
    clearError,
    setSearchQuery,
    setStatusFilter,
  } = useActionStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Filter actions based on search query and status filter
  const filteredActions = actions.filter((action) => {
    const matchesSearch =
      action.spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.spec.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      action.status.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getTagColor = (tag: string) => {
    if (tag === 'destructive') return 'var(--color-error)';
    if (tag === 'write') return 'var(--color-warning)';
    if (tag === 'read') return 'var(--color-success)';
    if (tag === 'network') return 'var(--color-primary)';
    return 'var(--color-text-tertiary)';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          text: t('actionsPage.status.healthy')
        };
      case 'error':
        return {
          bg: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          text: t('actionsPage.status.error')
        };
      case 'disabled':
        return {
          bg: 'var(--color-bg-secondary)',
          color: 'var(--color-text-tertiary)',
          text: t('actionsPage.status.disabled')
        };
      default:
        return {
          bg: 'var(--color-bg-secondary)',
          color: 'var(--color-text-tertiary)',
          text: '❓ Unknown'
        };
    }
  };

  const handleImportAction = async () => {
    setImportStatus(null);
    const actionName = await importAction();

    if (actionName) {
      setImportStatus(`Successfully imported "${actionName}"`);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const handleDeleteAction = (action: Action) => {
    setActionToDelete(action);
    setShowDeleteModal(true);
  };

  const confirmDeleteAction = () => {
    if (actionToDelete) {
      deleteAction(actionToDelete.directory_name);
      setShowDeleteModal(false);
      setActionToDelete(null);
    }
  };

  const handleClearError = (action: Action) => {
    // This would update the action status back to healthy
    // Implementation would depend on how we want to handle this
  };

  if (isLoading && actions.length === 0) {
    return (
      <div style={{
        padding: '24px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>{t('actionsPage.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: '600' }}>
            {t('actionsPage.title')}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {t('actionsPage.subtitle')}
          </p>
        </div>
        <button
          onClick={handleImportAction}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? t('common.loading') : t('actionsPage.importAction')}
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: '6px',
          color: 'var(--color-error)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {importStatus && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: '6px',
          color: 'var(--color-success)'
        }}>
          {importStatus}
        </div>
      )}

      {/* Search and Filters */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder={t('actionsPage.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <option value="all">{t('actionsPage.filter.all')}</option>
            <option value="healthy">{t('actionsPage.filter.healthy')}</option>
            <option value="error">{t('actionsPage.filter.error')}</option>
            <option value="disabled">{t('actionsPage.filter.disabled')}</option>
          </select>
        </div>

        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {filteredActions.length} {t('actionsPage.actionsFound', { count: filteredActions.length })}
        </div>
      </div>

      {/* Actions List */}
      <div style={{ flex: 1 }}>
        {filteredActions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--color-text-secondary)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.5
            }}>
              AC
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
              {actions.length === 0 ? t('actionsPage.noActions') : t('actionsPage.noActionsMatch')}
            </h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {actions.length === 0
                ? t('actionsPage.importFirstActionDescription')
                : t('actionsPage.noMatchDescription')
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredActions.map((action) => {
              const statusBadge = getStatusBadge(action.status.status);

              return (
                <div key={action.directory_name} style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: `1px solid ${action.status.status === 'error' ? 'var(--color-error-border)' : 'var(--color-border)'}`,
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '16px' }}>
                          {action.spec.name}
                        </h3>

                        <span
                          style={{
                            padding: '4px 8px',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {statusBadge.text}
                        </span>

                        {action.spec.tags && action.spec.tags.map((tag, index) => (
                          <span
                            key={index}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: `${getTagColor(tag)}20`,
                              color: getTagColor(tag),
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <p style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                        {action.spec.description}
                      </p>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        <span>{t('actionsPage.details.timeout')}: {action.spec.timeout_sec}s</span>
                        <span>{t('actionsPage.details.directory')}: {action.directory_name}</span>
                        {action.status.error_count > 0 && (
                          <span style={{ color: 'var(--color-error)' }}>
                            {t('actionsPage.details.errors')}: {action.status.error_count}
                          </span>
                        )}
                      </div>

                      {/* Error Details */}
                      {action.status.status === 'error' && action.status.last_error && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: 'var(--color-error-bg)',
                          border: '1px solid var(--color-error-border)',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px', color: 'var(--color-error)' }}>
                            {t('actionsPage.details.lastError')}:
                          </div>
                          <div style={{ color: 'var(--color-error)', marginBottom: '4px' }}>
                            {action.status.last_error.message}
                          </div>
                          <div style={{ color: 'var(--color-error-dark)', fontSize: '11px' }}>
                            {new Date(action.status.last_error.timestamp).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {action.status.status === 'error' && (
                        <button
                          onClick={() => handleClearError(action)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid var(--color-warning)',
                            backgroundColor: 'var(--color-bg-elevated)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: 'var(--color-warning)',
                            cursor: 'pointer'
                          }}
                        >
                          {t('actionsPage.status.clearError')}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteAction(action)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid var(--color-error)',
                          backgroundColor: 'var(--color-bg-elevated)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: 'var(--color-error)',
                          cursor: 'pointer'
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>

                  {action.spec.arguments && action.spec.arguments.length > 0 && (
                    <div>
                      <h4 style={{
                        margin: '0 0 8px 0',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {t('actionsPage.details.arguments')}:
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {action.spec.arguments.map((arg, index) => (
                          <div key={index} style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderRadius: '6px',
                            padding: '12px',
                            border: '1px solid var(--color-border)'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px'
                            }}>
                              <span style={{
                                fontWeight: '500',
                                color: 'var(--color-text-primary)',
                                fontSize: '13px'
                              }}>
                                {arg.name}
                              </span>
                              <span style={{
                                padding: '1px 6px',
                                backgroundColor: arg.required ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                                color: arg.required ? 'var(--color-error)' : 'var(--color-success)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                              }}>
                                {arg.required ? t('forms.required') : t('forms.optional')}
                              </span>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--color-text-secondary)',
                              marginBottom: '4px'
                            }}>
                              {arg.description}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: 'var(--color-text-tertiary)',
                              fontFamily: 'monospace'
                            }}>
                              {t('actionsPage.details.type')}: {arg.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && actionToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--color-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>
              {t('actionsPage.modal.delete')}
            </h3>
            <p style={{ margin: '0 0 24px 0', color: 'var(--color-text-secondary)' }}>
              {t('actionsPage.modal.deleteConfirm', { actionName: actionToDelete.spec.name })}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setActionToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDeleteAction}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-error)',
                  color: 'var(--color-text-inverse)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {t('actionsPage.modal.deleteAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsPage;