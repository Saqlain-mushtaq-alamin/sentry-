import React, { useEffect, useRef } from 'react';
import { useHideNativeView } from '../../hooks/useHideNativeView';

export interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  danger = false,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '6px 10px',
        border: 'none',
        background: 'transparent',
        color: danger ? 'var(--danger)' : 'var(--text)',
        fontSize: '12px',
        fontFamily: 'inherit',
        textAlign: 'left',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        gap: '8px',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = danger ? 'var(--danger-bg)' : 'var(--bg-3)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: danger ? 'var(--danger)' : 'var(--text-2)',
            flexShrink: 0,
            width: '16px',
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ flexGrow: 1, whiteSpace: 'nowrap' }}>{label}</span>
      {shortcut && (
        <span
          style={{
            color: 'var(--text-3)',
            fontSize: '11px',
            marginLeft: '12px',
            flexShrink: 0,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};

export const MenuDivider: React.FC = () => (
  <div
    style={{
      height: '1px',
      background: 'var(--border)',
      margin: '4px 0',
    }}
  />
);

export interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRight?: boolean;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  width?: number | string;
  children: React.ReactNode;
}

export const Menu: React.FC<MenuProps> = ({
  isOpen,
  onClose,
  top = '36px',
  right,
  left,
  width = 220,
  children,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Automatically hide native web view so menu is never covered
  useHideNativeView(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'absolute',
        top,
        ...(right !== undefined ? { right } : {}),
        ...(left !== undefined ? { left } : {}),
        width,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        padding: '4px',
        zIndex: 9999,
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      {children}
    </div>
  );
};
