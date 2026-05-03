import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({ 
  label, 
  icon, 
  multiline = false,
  className = '',
  ...props 
}) => {
  const containerClasses = "space-y-2";
  const inputClasses = `w-full ${icon ? 'pl-11' : 'px-4'} pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300 text-sm bg-gray-50/50`;

  return (
    <div className={containerClasses}>
      {label && <label className="text-sm font-medium text-gray-600 ml-1">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        {multiline ? (
          <textarea 
            className={`${inputClasses} ${className}`}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input 
            className={`${inputClasses} ${className}`}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>
    </div>
  );
};

export default TextField;
