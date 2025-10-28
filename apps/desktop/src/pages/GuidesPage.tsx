import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuideStore, Guide, GuideEntry, GuideMeta } from '../stores/useGuideStore';

const GuidesPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    guides,
    currentGuide,
    isLoading,
    error,
    loadGuides,
    loadGuide,
    saveGuide,
    createGuide,
    deleteGuide,
    clearError,
    initializeGuides
  } = useGuideStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [guideToDelete, setGuideToDelete] = useState<string | null>(null);

  // Form state for creating/editing guides
  const [formData, setFormData] = useState<Guide>({
    meta: {
      name: '',
      version: '1.0.0',
      domain: ''
    },
    entries: []
  });

  useEffect(() => {
    initializeGuides();
  }, []);

  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  const handleCreateGuide = () => {
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

  const handleEditGuide = async (filename: string) => {
    try {
      const guide = await loadGuide(filename);
      setEditingGuide(guide);
      setFormData({
        meta: { ...guide.meta },
        entries: [...guide.entries]
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load guide for editing:', error);
    }
  };

  const handleSaveGuide = async () => {
    try {
      if (showEditModal && editingGuide?.filename) {
        await saveGuide(editingGuide.filename, formData);
        setShowEditModal(false);
        setEditingGuide(null);
      } else {
        await createGuide(formData);
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
      console.error('Failed to save guide:', error);
    }
  };

  const handleDeleteGuide = (filename: string) => {
    setGuideToDelete(filename);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (guideToDelete) {
      try {
        await deleteGuide(guideToDelete);
        setShowDeleteConfirm(false);
        setGuideToDelete(null);
      } catch (error) {
        console.error('Failed to delete guide:', error);
      }
    }
  };

  const addEntry = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, {
        name: '',
        description: '',
        plan: ['']
      }]
    }));
  };

  const updateEntry = (index: number, field: keyof GuideEntry, value: any) => {
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

  const addPlanStep = (entryIndex: number) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === entryIndex
          ? { ...entry, plan: [...entry.plan, ''] }
          : entry
      )
    }));
  };

  const updatePlanStep = (entryIndex: number, stepIndex: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === entryIndex
          ? {
              ...entry,
              plan: entry.plan.map((step, j) =>
                j === stepIndex ? value : step
              )
            }
          : entry
      )
    }));
  };

  const removePlanStep = (entryIndex: number, stepIndex: number) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === entryIndex
          ? {
              ...entry,
              plan: entry.plan.filter((_, j) => j !== stepIndex)
            }
          : entry
      )
    }));
  };

  const GuideModal = ({
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'var(--color-bg-elevated)',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: 'var(--color-text-primary)' }}>{title}</h2>

          {/* Meta Information */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-secondary)', fontSize: '16px' }}>{t('guidesPage.form.information')}</h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  {t('guidesPage.form.name')} *
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
                  placeholder={t('guidesPage.form.name')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    {t('guidesPage.form.version')} *
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
                    {t('guidesPage.form.domain')}
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
              <h3 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '16px' }}>{t('guidesPage.form.entries')}</h3>
              <button
                onClick={addEntry}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {t('guidesPage.form.addEntry')}
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
                  {t('guidesPage.form.noEntriesYet')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formData.entries.map((entry, entryIndex) => (
                  <div key={entryIndex} style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '16px',
                    backgroundColor: 'var(--color-bg-tertiary)'
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
                          placeholder={t('guidesPage.form.entryName')}
                        />
                        <textarea
                          value={entry.description}
                          onChange={(e) => updateEntry(entryIndex, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            fontSize: '14px',
                            minHeight: '60px',
                            resize: 'vertical',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)'
                          }}
                          placeholder={t('guidesPage.form.entryDescription')}
                        />
                      </div>
                      <button
                        onClick={() => removeEntry(entryIndex)}
                        style={{
                          marginLeft: '12px',
                          padding: '6px',
                          backgroundColor: 'var(--color-error)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--color-text-secondary)' }}>
                          {t('guidesPage.form.planningSteps')}
                        </h4>
                        <button
                          onClick={() => addPlanStep(entryIndex)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'var(--color-accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          {t('guidesPage.form.addStep')}
                        </button>
                      </div>

                      {entry.plan.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '12px',
                          color: 'var(--color-text-tertiary)',
                          fontSize: '12px',
                          border: '1px dashed var(--color-border-subtle)',
                          borderRadius: '3px'
                        }}>
                          {t('guidesPage.form.noPlanningStepsYet')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {entry.plan.map((step, stepIndex) => (
                            <div key={stepIndex} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '12px',
                                color: 'var(--color-text-tertiary)',
                                minWidth: '20px'
                              }}>
                                {stepIndex + 1}.
                              </span>
                              <input
                                type="text"
                                value={step}
                                onChange={(e) => updatePlanStep(entryIndex, stepIndex, e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '4px 8px',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                  backgroundColor: 'var(--color-bg-elevated)',
                                  color: 'var(--color-text-primary)'
                                }}
                                placeholder={t('guidesPage.form.stepDescription')}
                              />
                              <button
                                onClick={() => removePlanStep(entryIndex, stepIndex)}
                                style={{
                                  padding: '4px',
                                  backgroundColor: 'var(--color-error)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '10px'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
              onClick={handleSaveGuide}
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
              {t('guidesPage.modal.save')}
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>{t('modals.delete')}</h3>
          <p style={{ margin: '0 0 24px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {t('guidesPage.modal.deleteConfirm')}
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
                color: 'var(--color-text-inverse)',
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
            {t('guidesPage.title')}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {t('guidesPage.subtitle')}
          </p>
        </div>
        <button
          onClick={handleCreateGuide}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {t('guidesPage.addGuide')}
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

      {/* Guides List */}
      <div style={{ flex: 1 }}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            color: 'var(--color-text-tertiary)'
          }}>
            {t('guidesPage.loading')}
          </div>
        ) : guides.length === 0 ? (
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
              📚
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
              {t('guidesPage.noGuides')}
            </h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {t('guidesPage.createFirstGuideDescription')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {guides.map((guide) => (
              <div key={guide.filename} style={{
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-text-primary)', fontSize: '16px' }}>
                      {guide.meta.name}
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
                        Version: {guide.meta.version}
                      </span>
                      {guide.meta.domain && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-secondary)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {guide.meta.domain}
                        </span>
                      )}
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)'
                      }}>
                        {t('guidesPage.entries.count', { count: guide.entryCount })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEditGuide(guide.filename)}
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
                      onClick={() => handleDeleteGuide(guide.filename)}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <GuideModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleSaveGuide}
        title={t('guidesPage.form.createTitle')}
      />
      <GuideModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingGuide(null);
        }}
        onSave={handleSaveGuide}
        title={t('guidesPage.form.editTitle')}
      />
      <DeleteConfirmModal />
    </div>
  );
};

export default GuidesPage;