import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface GeniusLogoProps {
  size?: number;
  className?: string;
}

export default function GeniusLogo({ size = 24, className = '' }: GeniusLogoProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        title="Genius App"
      >
        <BookOpen size={size * 0.6} />
      </div>
    );
  }

  return (
    <div 
      className={`relative rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-full" />
      )}
      <img
        src="/gmijp-logo.png"
        alt="Genius App Logo"
        width={size}
        height={size}
        className={`object-contain rounded-full w-full h-full transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}
