import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'normal' | 'large';
}

export function Button({ variant = 'primary', size = 'normal', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], size !== 'normal' ? styles[size] : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
