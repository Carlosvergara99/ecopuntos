import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'ghost' | 'glass' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'flex items-center justify-center rounded-full transition-all active:scale-90';
  
  const variants = {
    ghost: 'hover:bg-gray-100 text-gray-500',
    glass: 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm',
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg',
    secondary: 'bg-green-600 hover:bg-green-700 text-white shadow-lg',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2.5',
    lg: 'p-4',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};

export default IconButton;
