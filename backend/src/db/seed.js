// Datos iniciales en MongoDB: los 12 ecopuntos con sus niveles embebidos.
// Idempotente: replaceOne con upsert pisa el doc existente (mismo _id), no
// duplica. Uso directo: npm run db:seed. También lo invoca db:reset.

import { connectMongo, collection, closeMongo } from './mongo.js';

const ECOPUNTOS_SEED = [
  { id: '1', nombre: 'Ecopunto Fontibón Centro', direccion: 'Carrera 99 # 18-20', horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM', lat: 4.6735, lng: -74.1450,
    niveles: [{ nombre: 'Madera', porcentaje: 25, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 80, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 10, color: '#3b82f6' }] },
  { id: '2', nombre: 'Ecopunto Usaquén Norte', direccion: 'Calle 161 # 7-40', horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM', lat: 4.7350, lng: -74.0320,
    niveles: [{ nombre: 'Madera', porcentaje: 60, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 30, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 45, color: '#3b82f6' }] },
  { id: '3', nombre: 'Ecopunto Kennedy Central', direccion: 'Avenida 1 de Mayo # 71-10', horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM', lat: 4.6200, lng: -74.1350,
    niveles: [{ nombre: 'Madera', porcentaje: 15, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 95, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 20, color: '#3b82f6' }] },
  { id: '4', nombre: 'Ecopunto Suba Tibabuyes', direccion: 'Carrera 91 # 145-30', horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM', lat: 4.7440, lng: -74.0840,
    niveles: [{ nombre: 'Madera', porcentaje: 40, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 55, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 70, color: '#3b82f6' }] },
  { id: '5', nombre: 'Ecopunto Engativá Boyacá', direccion: 'Calle 80 # 96-40', horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM', lat: 4.7050, lng: -74.1100,
    niveles: [{ nombre: 'Madera', porcentaje: 75, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 20, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 35, color: '#3b82f6' }] },
  { id: '6', nombre: 'Ecopunto Chapinero Norte', direccion: 'Carrera 13 # 63-20', horario: 'Lunes a Sábado: 9:00 AM - 6:00 PM', lat: 4.6500, lng: -74.0620,
    niveles: [{ nombre: 'Madera', porcentaje: 10, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 25, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 85, color: '#3b82f6' }] },
  { id: '7', nombre: 'Ecopunto Teusaquillo Salitre', direccion: 'Calle 40 # 22-15', horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM', lat: 4.6320, lng: -74.0880,
    niveles: [{ nombre: 'Madera', porcentaje: 50, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 65, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 30, color: '#3b82f6' }] },
  { id: '8', nombre: 'Ecopunto Bosa Recreo', direccion: 'Carrera 80I # 65-30 Sur', horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM', lat: 4.6200, lng: -74.1850,
    niveles: [{ nombre: 'Madera', porcentaje: 85, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 75, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 60, color: '#3b82f6' }] },
  { id: '9', nombre: 'Ecopunto Ciudad Bolívar Lucero', direccion: 'Avenida Boyacá # 70-20 Sur', horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM', lat: 4.5750, lng: -74.1500,
    niveles: [{ nombre: 'Madera', porcentaje: 35, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 90, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 15, color: '#3b82f6' }] },
  { id: '10', nombre: 'Ecopunto San Cristóbal Sur', direccion: 'Carrera 5A # 32-50 Sur', horario: 'Martes a Sábado: 9:00 AM - 5:00 PM', lat: 4.5630, lng: -74.0830,
    niveles: [{ nombre: 'Madera', porcentaje: 20, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 45, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 55, color: '#3b82f6' }] },
  { id: '11', nombre: 'Ecopunto Tunjuelito Venecia', direccion: 'Calle 51 Sur # 24-50', horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM', lat: 4.5780, lng: -74.1310,
    niveles: [{ nombre: 'Madera', porcentaje: 65, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 40, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 25, color: '#3b82f6' }] },
  { id: '12', nombre: 'Ecopunto Barrios Unidos Polo', direccion: 'Calle 71 # 52-30', horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM', lat: 4.6700, lng: -74.0830,
    niveles: [{ nombre: 'Madera', porcentaje: 30, color: '#f97316' }, { nombre: 'Escombros (Construcción)', porcentaje: 50, color: '#64748b' }, { nombre: 'Muebles y Enseres', porcentaje: 80, color: '#3b82f6' }] },
];

export async function seed() {
  await connectMongo();
  const ecopuntos = await collection('ecopuntos');
  for (const eco of ECOPUNTOS_SEED) {
    await ecopuntos.replaceOne(
      { _id: eco.id },
      {
        _id: eco.id,
        nombre: eco.nombre,
        direccion: eco.direccion,
        horario: eco.horario,
        lat: eco.lat,
        lng: eco.lng,
        niveles: eco.niveles,
      },
      { upsert: true }
    );
  }
  console.log(`[seed] ${ECOPUNTOS_SEED.length} ecopuntos en MongoDB.`);
}

// Ejecutar solo si se corre directamente (no al ser importado por reset.js).
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed()
    .then(closeMongo)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[seed] Error:', e.message);
      process.exit(1);
    });
}
