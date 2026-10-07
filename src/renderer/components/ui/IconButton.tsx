import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  children,
  active = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <button
      className={`icon-btn ${active ? 'active' : ''} ${className}`}
      title={label}
      aria-label={label}
      style={{
        ...(active ? { background: 'var(--bg-3)', color: 'var(--text)' } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};
