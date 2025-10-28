import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { LightningIcon, CheckIcon, XIcon, GearIcon } from './Icons';

const StatusBar: React.FC = () => {
  const { error, is_loading, status_message } = useAppStore();
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    const updateTimestamp = () => {
      setTimestamp(new Date().toLocaleTimeString());
    };

    updateTimestamp();
    const interval = setInterval(updateTimestamp, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusMessage = () => {
    if (status_message) {
      return status_message;
    }
    if (error) {
      return `Error: ${error}`;
    }
    if (is_loading) {
      return 'Processing request...';
    }
    return 'Ready';
  };

  const getStatusIcon = () => {
    if (error) return <XIcon size={10} />;
    if (is_loading) return <GearIcon size={10} />;
    return <CheckIcon size={10} />;
  };

  const getStatusClass = () => {
    if (error) return 'text-error';
    if (is_loading) return 'text-info';
    return 'text-success';
  };

  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--spacing-xs) var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        height: 'var(--status-bar-height)',
        flexShrink: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 'var(--spacing-xs)',
          color: getStatusClass(),
          flex: 1,
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        <span style={{ flexShrink: 0 }}>{getStatusIcon()}</span>
        <span style={{
          fontWeight: '500',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {getStatusMessage()}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          color: 'var(--color-text-tertiary)',
          flexShrink: 0
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            flexShrink: 0
          }}
        >
          <LightningIcon size={10} />
        </span>
        <span style={{ flexShrink: 0 }}>Pulsar Studio</span>
        <span style={{ opacity: 0.7, flexShrink: 0 }}>v0.1.0</span>
      </div>

      <div
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: '11px',
          fontWeight: '500',
          flexShrink: 0
        }}
      >
        {timestamp}
      </div>
    </div>
  );
};

export default StatusBar;