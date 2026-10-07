import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--accent)',
          color: '#ffffff',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid rgba(229, 72, 77, 0.25)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-2)',
          border: '1px solid transparent',
        };
      case 'secondary':
      default:
        return {
          background: 'var(--bg-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
        };
    }
  };

  const getSizeStyle = (): React.CSSProperties => {
    if (size === 'sm') {
      return {
        height: '24px',
        padding: '0 8px',
        fontSize: '11px',
      };
    }
    return {
      height: 'var(--control-h)',
      padding: '0 12px',
      fontSize: '12px',
    };
  };

  return (
    <button
      className={`ui-btn ${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontWeight: 500,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.45 : 1,
        transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        flexShrink: 0,
        userSelect: 'none',
        ...getVariantStyle(),
        ...getSizeStyle(),
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};
