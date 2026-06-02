import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 rounded-2xl';
  
  const variants = {
    primary: 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700',
    secondary: 'bg-green-600 text-white shadow-lg shadow-green-100 hover:bg-green-700',
    outline: 'border-2 border-gray-100 text-gray-600 hover:bg-gray-50',
    danger: 'bg-red-600 text-white shadow-lg shadow-red-100 hover:bg-red-700',
    ghost: 'bg-transparent text-gray-500 hover:bg-gray-100',
    success: 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700',
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-4 text-sm',
    lg: 'px-8 py-5 text-base',
  };

  const combinedClasses = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  return (
    <button
      className={combinedClasses}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
      ) : leftIcon ? (
        <span className="mr-2.5">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && <span className="ml-2.5">{rightIcon}</span>}
    </button>
  );
};

export default Button;
