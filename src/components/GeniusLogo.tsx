import React from 'react';

interface GeniusLogoProps {
  size?: number;
  className?: string;
}

export default function GeniusLogo({ size = 24, className = '' }: GeniusLogoProps) {
  return (
    <img
      src="/gmijp-logo.png"
      alt="GMIJP"
      width={size}
      height={size}
      className={`object-contain rounded-full ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
}
