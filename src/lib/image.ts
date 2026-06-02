// Utilidad para convertir una imagen (File) en un data URL base64 ya
// redimensionado y comprimido. Reduce el lado mayor a `maxDim` px y la exporta
// como JPEG con la calidad indicada, para que la foto NO pese varios MB al
// guardarse como texto base64 en SQLite. Todo ocurre en el cliente (canvas),
// sin red — la foto ya llega liviana al backend.

export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 1024,
  quality = 0.7
): Promise<string> {
  // Cargamos el archivo en un <img> vía object URL (lo liberamos al final).
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      image.src = objectUrl;
    });

    // Escala manteniendo proporción. Nunca agranda (escala <= 1).
    const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen (canvas).');
    ctx.drawImage(img, 0, 0, w, h);

    // toDataURL devuelve el JPEG comprimido como "data:image/jpeg;base64,...".
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
