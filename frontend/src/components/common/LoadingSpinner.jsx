import React from 'react';

export const LoadingSpinner = ({ text = 'Loading...', size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <div className={`${sizeClasses} border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin`} />
      {text && <p className="text-sm font-medium text-gray-500">{text}</p>}
    </div>
  );
};
