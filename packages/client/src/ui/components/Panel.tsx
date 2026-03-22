import React from 'react';
import styles from './Panel.module.css';

export interface PanelProps {
  variant?: 'dark' | 'parchment' | 'glass';
  border?: string | boolean;
  ornate?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Panel({
  variant = 'dark',
  border,
  ornate = false,
  className = '',
  style,
  children,
  onClick,
}: PanelProps) {
  const borderStyle: React.CSSProperties = {};

  if (typeof border === 'string') {
    borderStyle.borderColor = border;
    (borderStyle as Record<string, string>)['--panel-border-color'] = border;
  } else if (border === true) {
    // Use faction color via CSS var
  }

  const classNames = [
    styles.panel,
    styles[variant],
    ornate ? styles.ornate : '',
    border === true ? styles.borderFaction : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      style={{ ...borderStyle, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
