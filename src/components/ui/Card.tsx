import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'white' | 'glass';
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  variant = 'white',
  padding = true
}) => {
  const variants = {
    white: 'bg-white',
    glass: 'bg-white/80 backdrop-blur-md border border-white/20',
  };

  return (
    <div className={`rounded-[32px] shadow-2xl overflow-hidden ${variants[variant]} ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
