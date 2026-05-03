import React from 'react';
import { X, MapPin, Clock, Navigation } from 'lucide-react';
import type { EcoPunto } from '../data/ecopuntos';
import Button from './ui/Button';
import IconButton from './ui/IconButton';

interface EcoPuntoCardProps {
  punto: EcoPunto;
  onClose: () => void;
  onTraceRoute: () => void;
}

const EcoPuntoCard: React.FC<EcoPuntoCardProps> = ({ punto, onClose, onTraceRoute }) => {
  return (
    <div className="w-[320px] sm:w-[360px] animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-green-600 p-6 flex justify-between items-start text-white">
          <div className="space-y-1">
            <h3 className="text-xl font-bold leading-tight">{punto.name}</h3>
            <div className="flex items-center gap-1.5 text-green-50 text-xs opacity-90">
              <MapPin className="w-3.5 h-3.5" />
              <span>{punto.address}</span>
            </div>
          </div>
          <IconButton 
            icon={<X className="w-4 h-4" />} 
            onClick={onClose} 
            variant="glass" 
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Hours */}
          <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3 border border-blue-50">
            <div className="bg-white p-2 rounded-xl shadow-sm text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-700">{punto.hours}</span>
          </div>

          {/* Waste Levels */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase ml-1">
              AFORO Y RESIDUOS PERMITIDOS
            </h4>
            
            <div className="space-y-5">
              {punto.wasteLevels.map((waste) => (
                <div key={waste.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-600 px-1">
                    <span>{waste.name}</span>
                    <span>{waste.percentage}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: `${waste.percentage}%`, 
                        backgroundColor: waste.color 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={onTraceRoute}
            fullWidth
            variant="primary"
            leftIcon={<Navigation className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
            className="group"
          >
            Trazar ruta hasta aquí
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EcoPuntoCard;

