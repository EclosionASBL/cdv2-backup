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
      maxSizeMB: 0.2, // Limite stricte à 200 KB (0.2 MB)
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
 * @param maxDimension Dimension maximale souhaitée (par défaut 800px)
 * @returns Promise avec le fichier original ou optimisé
 */
export const optimizeImageIfNeeded = async (
  file: File,
  maxDimension = 800
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  
  // Définir des seuils de taille pour différents niveaux de compression
  const TARGET_SIZE = 200 * 1024;  // 200KB - taille cible maximale
  const SIZE_THRESHOLD_SMALL = 150 * 1024;  // 150KB
  const SIZE_THRESHOLD_MEDIUM = 500 * 1024; // 500KB
  const SIZE_THRESHOLD_LARGE = 1 * 1024 * 1024; // 1MB
  const SIZE_THRESHOLD_XLARGE = 2 * 1024 * 1024; // 2MB
  
  // Si l'image est déjà sous la taille cible, pas besoin d'optimiser
  if (file.size <= TARGET_SIZE) {
    return file;
  }
  
  // Déterminer les paramètres d'optimisation en fonction de la taille
  let quality = 0.8;
  let maxWidthOrHeight = maxDimension;
  
  if (file.size > SIZE_THRESHOLD_XLARGE) { // > 2MB
    quality = 0.4; // Compression très agressive
    maxWidthOrHeight = 800;
  } else if (file.size > SIZE_THRESHOLD_LARGE) { // > 1MB
    quality = 0.5; // Compression agressive
    maxWidthOrHeight = 1000;
  } else if (file.size > SIZE_THRESHOLD_MEDIUM) { // > 500KB
    quality = 0.6; // Compression modérée
    maxWidthOrHeight = 800;
  } else {
    // Entre la taille cible et 500KB
    quality = 0.7;
    maxWidthOrHeight = 800;
  }
  
  // Appliquer la compression avec les paramètres déterminés
  let compressedFile = await optimizeImage(file, maxWidthOrHeight, quality);
  
  // Si la compression n'a pas été suffisante, essayer une compression plus agressive
  if (compressedFile.size > TARGET_SIZE) {
    console.log('Compression initiale insuffisante, application d\'une compression plus agressive');
    compressedFile = await optimizeImage(compressedFile, Math.min(maxWidthOrHeight, 700), 0.5);
    
    // Si toujours trop grand, essayer une compression encore plus agressive
    if (compressedFile.size > TARGET_SIZE) {
      console.log('Compression secondaire insuffisante, application d\'une compression très agressive');
      compressedFile = await optimizeImage(compressedFile, 600, 0.4);
    }
  }
  
  return compressedFile;
};