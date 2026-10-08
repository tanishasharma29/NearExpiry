import React from 'react';

/**
 * AdminMotionContainer
 * Lightweight, accessible motion primitive for NearExpiry Admin Portal.
 * Implements subtle SaaS transitions (150-250ms) without heavy external animation libraries.
 * Strictly honors `prefers-reduced-motion` to guarantee full accessibility compliance.
 */
export const AdminMotionContainer = ({
  children,
  as: Component = 'div',
  animation = 'fade-slide-up', // 'fade' | 'fade-slide-up' | 'scale-in' | 'expand' | 'none'
  hoverEffect = false,        // subtle elevation & border emphasis on hover
  pressable = false,          // active click press feedback
  delayMs = 0,
  className = '',
  ...props
}) => {
  // Animation entrance styles
  const animationClasses = {
    fade: 'animate-fade-in transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:animate-none',
    'fade-slide-up':
      'transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none transform translate-y-0 opacity-100',
    'scale-in':
      'transition-all duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none transform scale-100 opacity-100',
    expand:
      'transition-all duration-200 ease-in-out motion-reduce:transition-none overflow-hidden',
    none: '',
  }[animation] || '';

  // Interactive micro-interaction styles
  const hoverClasses = hoverEffect
    ? 'hover:-translate-y-0.5 hover:shadow-md hover:border-purple-200 transition-all duration-150 ease-out motion-reduce:hover:translate-y-0 motion-reduce:transition-none'
    : '';

  const pressableClasses = pressable
    ? 'active:scale-[0.99] active:transition-transform duration-75 motion-reduce:active:scale-100'
    : '';

  const inlineStyle = delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined;

  return (
    <Component
      className={`${animationClasses} ${hoverClasses} ${pressableClasses} ${className}`}
      style={inlineStyle}
      {...props}
    >
      {children}
    </Component>
  );
};

export default AdminMotionContainer;

