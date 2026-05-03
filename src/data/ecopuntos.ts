export interface WasteLevel {
  name: string;
  percentage: number;
  color: string;
}

export interface EcoPunto {
  id: string;
  name: string;
  address: string;
  hours: string;
  lat: number;
  lng: number;
  wasteLevels: WasteLevel[];
}

export const ECO_PUNTOS: EcoPunto[] = [
  {
    id: '1',
    name: 'Ecopunto Fontibón Centro',
    address: 'Carrera 99 # 18-20',
    hours: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.6735,
    lng: -74.1450,
    wasteLevels: [
      { name: 'Madera', percentage: 25, color: '#f97316' },
      { name: 'Escombros (Construcción)', percentage: 80, color: '#64748b' },
      { name: 'Muebles y Enseres', percentage: 10, color: '#3b82f6' },
    ]
  },
  {
    id: '2',
    name: 'Ecopunto Usaquén Norte',
    address: 'Calle 161 # 7-40',
    hours: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
    lat: 4.7350,
    lng: -74.0320,
    wasteLevels: [
      { name: 'Madera', percentage: 60, color: '#f97316' },
      { name: 'Escombros (Construcción)', percentage: 30, color: '#64748b' },
      { name: 'Muebles y Enseres', percentage: 45, color: '#3b82f6' },
    ]
  },
  {
    id: '3',
    name: 'Ecopunto Kennedy Central',
    address: 'Avenida 1 de Mayo # 71-10',
    hours: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
    lat: 4.6200,
    lng: -74.1350,
    wasteLevels: [
      { name: 'Madera', percentage: 15, color: '#f97316' },
      { name: 'Escombros (Construcción)', percentage: 95, color: '#64748b' },
      { name: 'Muebles y Enseres', percentage: 20, color: '#3b82f6' },
    ]
  }
];
