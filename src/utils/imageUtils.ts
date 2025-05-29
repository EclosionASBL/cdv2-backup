/**
 * Utilitaires pour l'optimisation des images avant téléchargement
 * Réduit la taille des images pour diminuer l'Egress Supabase
 */
import imageCompression from 'browser-image-compression';

/**
 * Compresse et redimensionne une image avant son téléchargement
 * @param file Le fichier image original
 * @param maxWidthOrHeight Dimension maximale de l'image (par défaut 800px)
 * @param quality Qualité de compression (0-1, par défaut 0.8)
 * @returns Promise avec le fichier compressé
 */
export const optimizeImage = async (
  file: File,
  maxWidthOrHeight = 800,
  quality = 0.8
): Promise<File> => {
  // Vérifier si le fichier est une image
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: file.type,
      quality
    };

    const compressedFile = await imageCompression(file, options);
    
    // Afficher les statistiques de compression dans la console
    console.log(`Image optimisée: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% de réduction)`);
    
    return compressedFile;
  } catch (error) {
    console.error('Erreur lors de la compression de l\'image:', error);
    return file; // En cas d'erreur, retourner le fichier original
  }
};

/**
 * Vérifie si une image dépasse une certaine taille et l'optimise si nécessaire
 * @param file Le fichier image
 * @param sizeThresholdKB Seuil en KB au-delà duquel l'image sera optimisée
 * @returns Promise avec le fichier original ou optimisé
 */
export const optimizeImageIfNeeded = async (
  file: File,
  sizeThresholdKB = 500
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  
  // Si l'image est déjà petite, pas besoin d'optimiser
  if (file.size <= sizeThresholdKB * 1024) {
    return file;
  }
  
  // Déterminer les paramètres d'optimisation en fonction de la taille
  let quality = 0.8;
  let maxDimension = 800;
  
  if (file.size > 2 * 1024 * 1024) { // > 2MB
    quality = 0.7;
    maxDimension = 1200;
  } else if (file.size > 1 * 1024 * 1024) { // > 1MB
    quality = 0.75;
    maxDimension = 1000;
  }
  
  return optimizeImage(file, maxDimension, quality);
};