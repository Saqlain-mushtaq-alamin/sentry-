import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  children,
  className = '',
  style,
  ...props
}) => {
  const getPaddingStyle = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return 'var(--space-2)';
      case 'lg': return 'var(--space-6)';
      case 'md': default: return 'var(--space-4)';
    }
  };

  return (
    <div
      className={`flat-card ${className}`}
      style={{
        padding: getPaddingStyle(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
