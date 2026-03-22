import React from 'react';
import styles from './MedievalButton.module.css';

export interface MedievalButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'faction' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function MedievalButton({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  style,
  children,
}: MedievalButtonProps) {
  const classNames = [
    styles.btn,
    styles[size],
    styles[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classNames}
      style={style}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
