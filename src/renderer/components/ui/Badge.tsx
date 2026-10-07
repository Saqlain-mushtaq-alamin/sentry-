import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dot = false,
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <span className={`badge-tint ${variant} ${className}`} style={style} {...props}>
      {dot && <span className={`status-dot ${variant}`} />}
      {children}
    </span>
  );
};
