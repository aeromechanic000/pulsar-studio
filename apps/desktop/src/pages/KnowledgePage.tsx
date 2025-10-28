import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeStore, Knowledge, KnowledgeEntry, KnowledgeMeta } from '../stores/useKnowledgeStore';

const KnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    knowledge,
    currentKnowledge,
    isLoading,
    error,
    loadKnowledge,
    loadKnowledgeFile,
    saveKnowledge,
    createKnowledge,
    deleteKnowledge,
    clearError,
    initializeKnowledge
  } = useKnowledgeStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [knowledgeToDelete, setKnowledgeToDelete] = useState<string | null>(null);

  // Form state for creating/editing knowledge
  const [formData, setFormData] = useState<Knowledge>({
    meta: {
      name: '',
      version: '1.0.0',
      domain: ''
    },
    entries: []
  });

  useEffect(() => {
    initializeKnowledge();
  }, []);

  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  const handleCreateKnowledge = () => {
    setFormData({
      meta: {
        name: '',
        version: '1.0.0',
        domain: ''
      },
      entries: []
    });
    setShowCreateModal(true);
  };

  const handleEditKnowledge = async (filename: string) => {
    try {
      const knowledge = await loadKnowledgeFile(filename);
      setEditingKnowledge(knowledge);
      setFormData({
        meta: { ...knowledge.meta },
        entries: [...knowledge.entries]
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load knowledge for editing:', error);
    }
  };

  const handleSaveKnowledge = async () => {
    try {
      if (showEditModal && editingKnowledge?.filename) {
        await saveKnowledge(editingKnowledge.filename, formData);
        setShowEditModal(false);
        setEditingKnowledge(null);
      } else {
        await createKnowledge(formData);
        setShowCreateModal(false);
      }

      // Reset form
      setFormData({
        meta: {
          name: '',
          version: '1.0.0',
          domain: ''
        },
        entries: []
      });
    } catch (error) {
      console.error('Failed to save knowledge:', error);
    }
  };

  const handleDeleteKnowledge = (filename: string) => {
    setKnowledgeToDelete(filename);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (knowledgeToDelete) {
      try {
        await deleteKnowledge(knowledgeToDelete);
        setShowDeleteConfirm(false);
        setKnowledgeToDelete(null);
      } catch (error) {
        console.error('Failed to delete knowledge:', error);
      }
    }
  };

  const addEntry = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, {
        name: '',
        description: '',
        content: ''
      }]
    }));
  };

  const updateEntry = (index: number, field: keyof KnowledgeEntry, value: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const removeEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index)
    }));
  };

  const KnowledgeModal = ({
    isOpen,
    onClose,
    onSave,
    title
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    title: string;
  }) => {
    if (!isOpen) return null;

    return (
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
          maxWidth: '900px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-xl)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: 'var(--color-text-primary)' }}>{title}</h2>

          {/* Meta Information */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-secondary)', fontSize: '16px' }}>{t('knowledgePage.form.information')}</h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  {t('knowledgePage.form.name')} *
                </label>
                <input
                  type="text"
                  value={formData.meta.name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    meta: { ...prev.meta, name: e.target.value }
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)'
                  }}
                  placeholder={t('knowledgePage.form.name')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    {t('knowledgePage.form.version')} *
                  </label>
                  <input
                    type="text"
                    value={formData.meta.version}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      meta: { ...prev.meta, version: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-primary)'
                    }}
                    placeholder="1.0.0"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    {t('knowledgePage.form.domain')}
                  </label>
                  <input
                    type="text"
                    value={formData.meta.domain || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      meta: { ...prev.meta, domain: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-primary)'
                    }}
                    placeholder="development, marketing, etc."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Entries */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '16px' }}>{t('knowledgePage.form.entries')}</h3>
              <button
                onClick={addEntry}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-success)',
                  color: 'var(--color-text-inverse)',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {t('knowledgePage.form.addEntry')}
              </button>
            </div>

            {formData.entries.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--color-text-tertiary)',
                border: '1px dashed var(--color-border-subtle)',
                borderRadius: '4px'
              }}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {t('knowledgePage.form.noEntriesYet')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formData.entries.map((entry, entryIndex) => (
                  <div key={entryIndex} style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '16px',
                    backgroundColor: 'var(--color-bg-secondary)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateEntry(entryIndex, 'name', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            fontSize: '14px',
                            marginBottom: '8px',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)'
                          }}
                          placeholder={t('knowledgePage.form.entryName')}
                        />
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateEntry(entryIndex, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            fontSize: '14px',
                            marginBottom: '8px',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)'
                          }}
                          placeholder={t('knowledgePage.form.entryDescription')}
                        />
                        <textarea
                          value={entry.content}
                          onChange={(e) => updateEntry(entryIndex, 'content', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            fontSize: '14px',
                            minHeight: '100px',
                            resize: 'vertical',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)'
                          }}
                          placeholder={t('knowledgePage.form.entryContent')}
                        />
                      </div>
                      <button
                        onClick={() => removeEntry(entryIndex)}
                        style={{
                          marginLeft: '12px',
                          padding: '6px',
                          backgroundColor: 'var(--color-error)',
                          color: 'var(--color-text-inverse)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '20px',
            borderTop: '1px solid var(--color-border)'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveKnowledge}
              disabled={!formData.meta.name.trim() || formData.entries.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: (!formData.meta.name.trim() || formData.entries.length === 0) ? 0.5 : 1
              }}
            >
              {t('knowledgePage.modal.save')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DeleteConfirmModal = () => {
    if (!showDeleteConfirm) return null;

    return (
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
          width: '90%',
          boxShadow: 'var(--shadow-xl)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>{t('modals.delete')}</h3>
          <p style={{ margin: '0 0 24px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {t('knowledgePage.modal.deleteConfirm')}
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmDelete}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-error)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            {t('knowledgePage.title')}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {t('knowledgePage.subtitle')}
          </p>
        </div>
        <button
          onClick={handleCreateKnowledge}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {t('knowledgePage.addKnowledge')}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: '6px',
          color: 'var(--color-error)',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Knowledge List */}
      <div style={{ flex: 1 }}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            color: 'var(--color-text-secondary)'
          }}>
            {t('knowledgePage.loading')}
          </div>
        ) : knowledge.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--color-text-tertiary)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.5
            }}>
              🧠
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
              {t('knowledgePage.noKnowledge')}
            </h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {t('knowledgePage.createFirstKnowledgeDescription')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {knowledge.map((knowledge) => (
              <div key={knowledge.filename} style={{
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
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
                    <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-text-primary)', fontSize: '16px' }}>
                      {knowledge.meta.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)'
                      }}>
                        Version: {knowledge.meta.version}
                      </span>
                      {knowledge.meta.domain && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-secondary)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {knowledge.meta.domain}
                        </span>
                      )}
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)'
                      }}>
                        {t('knowledgePage.entries.count', { count: knowledge.entryCount })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEditKnowledge(knowledge.filename)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-elevated)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteKnowledge(knowledge.filename)}
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

                {/* Preview of first few entries */}
                {knowledge.entryCount > 0 && (
                  <div style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    maxHeight: '120px',
                    overflow: 'auto',
                    border: '1px solid var(--color-border)'
                  }}>
                    <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                      Preview (first 3 entries):
                    </div>
                    {knowledge.entryCount > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Array.from(
                        { length: Math.min(3, knowledge.entryCount) },
                        (_, index) => (
                          <div key={index} style={{
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          lineHeight: '1.4'
                        }}>
                          {index + 1}. Entry {index + 1}
                        </div>
                        )
                      )}
                    </div>
                  )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <KnowledgeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleSaveKnowledge}
        title={t('knowledgePage.form.createTitle')}
      />
      <KnowledgeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingKnowledge(null);
        }}
        onSave={handleSaveKnowledge}
        title={t('knowledgePage.form.editTitle')}
      />
      <DeleteConfirmModal />
    </div>
  );
};

export default KnowledgePage;