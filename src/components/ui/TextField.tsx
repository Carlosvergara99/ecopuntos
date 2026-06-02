import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  // rows aplica cuando multiline=true (lo consume el <textarea>). Lo
  // declaramos acá porque InputHTMLAttributes no lo trae.
  rows?: number;
  // Elemento opcional a la derecha del input (ej: botón de ver contraseña).
  rightSlot?: React.ReactNode;
  // Mensaje de error de validación. Si viene, el campo se pinta en rojo y se
  // muestra el mensaje debajo.
  error?: string;
  // Marca el campo como obligatorio: agrega un asterisco rojo al label.
  requiredMark?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  icon,
  multiline = false,
  rightSlot,
  error,
  requiredMark = false,
  className = '',
  ...props
}) => {
  const containerClasses = "space-y-2";
  // El borde y el anillo de foco cambian a rojo cuando hay error.
  const borde = error
    ? 'border-red-300 focus:ring-red-400'
    : 'border-gray-200 focus:ring-green-500';
  const inputClasses = `w-full ${icon ? 'pl-11' : 'pl-4'} ${rightSlot ? 'pr-11' : 'pr-4'} py-3 rounded-xl border ${borde} focus:ring-2 focus:border-transparent outline-none transition-all placeholder:text-gray-300 text-sm bg-gray-50/50`;

  return (
    <div className={containerClasses}>
      {label && (
        <label className="text-sm font-medium text-gray-600 ml-1">
          {label}
          {requiredMark && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        {rightSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            {rightSlot}
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
      {error && <p className="text-xs text-red-600 ml-1">{error}</p>}
    </div>
  );
};

export default TextField;
