export interface ScannedAudioTrack {
  name: string;
  filename: string;
  num: number;
  url: string;
}

export interface ScannedPlaylistsData {
  'playlist-1'?: ScannedAudioTrack[];
  'playlist-2'?: ScannedAudioTrack[];
  [key: string]: ScannedAudioTrack[] | undefined;
}

// Dictionnaire de traduction en français sans les numéros devant
export const TRACK_TRANSLATIONS: Record<string, string> = {
  // Playlist 1
  'verdant glade': 'Clairière Verdoyante',
  'sunlit canopy': 'Canopée Ensoleillée',
  'pastoral haven': 'Havre Pastoral',
  'forgotten grove': 'Bosquet Oublié',
  'elder roots': 'Racines Anciennes',
  'silent thicket': 'Fourré Silencieux',
  'cold calculation': 'Froid Calcul',
  'dark counsel': 'Sombre Conseil',
  'iron siege': 'Siège de Fer',
  'blood and iron': 'Le Sang et le Fer',

  // Playlist 2
  'verdant threshold': 'Seuil Verdoyant',
  'sylvan haven': 'Refuge Sylvestre',
  'village dawn': 'Aube sur le Village',
  'ancient glade': 'Clairière Ancestrale',
  'forgotten glade': 'Clairière Oubliée',
  'the gloomwood': "Le Bois d'Ombre",
  'silent siege': 'Siège Silencieux',
  'cold calculus': 'Calcul Glacial',
  'obsidian dread': "Terreur d'Obsidienne",
  'siege of ashes': 'Siège de Cendres',
};

// Données initiales immédiatement disponibles avec les noms traduits en français
// et sans le numéro dans le titre (le numéro est conservé dans le badge #)
export const DEFAULT_SCANNED_AUDIO: ScannedPlaylistsData = {
  'playlist-1': [
    { name: 'Clairière Verdoyante', filename: '1 Verdant Glade.mp3', num: 1, url: '/audio/playlist-1/1 Verdant Glade.mp3' },
    { name: 'Canopée Ensoleillée', filename: '2 Sunlit Canopy.mp3', num: 2, url: '/audio/playlist-1/2 Sunlit Canopy.mp3' },
    { name: 'Havre Pastoral', filename: '3 Pastoral Haven.mp3', num: 3, url: '/audio/playlist-1/3 Pastoral Haven.mp3' },
    { name: 'Bosquet Oublié', filename: '4 Forgotten Grove.mp3', num: 4, url: '/audio/playlist-1/4 Forgotten Grove.mp3' },
    { name: 'Racines Anciennes', filename: '5 Elder Roots.mp3', num: 5, url: '/audio/playlist-1/5 Elder Roots.mp3' },
    { name: 'Fourré Silencieux', filename: '6 Silent Thicket.mp3', num: 6, url: '/audio/playlist-1/6 Silent Thicket.mp3' },
    { name: 'Froid Calcul', filename: '7 Cold Calculation.mp3', num: 7, url: '/audio/playlist-1/7 Cold Calculation.mp3' },
    { name: 'Sombre Conseil', filename: '8 Dark Counsel .mp3', num: 8, url: '/audio/playlist-1/8 Dark Counsel .mp3' },
    { name: 'Siège de Fer', filename: '9 Iron Siege .mp3', num: 9, url: '/audio/playlist-1/9 Iron Siege .mp3' },
    { name: 'Le Sang et le Fer', filename: '91 Blood and Iron .mp3', num: 10, url: '/audio/playlist-1/91 Blood and Iron .mp3' },
  ],
  'playlist-2': [
    { name: 'Seuil Verdoyant', filename: '1 Verdant Threshold.mp3', num: 1, url: '/audio/playlist-2/1 Verdant Threshold.mp3' },
    { name: 'Refuge Sylvestre', filename: '2 Sylvan Haven.mp3', num: 2, url: '/audio/playlist-2/2 Sylvan Haven.mp3' },
    { name: 'Aube sur le Village', filename: '3 Village Dawn.mp3', num: 3, url: '/audio/playlist-2/3 Village Dawn.mp3' },
    { name: 'Clairière Ancestrale', filename: '4 Ancient Glade.mp3', num: 4, url: '/audio/playlist-2/4 Ancient Glade.mp3' },
    { name: 'Clairière Oubliée', filename: '5 Forgotten Glade.mp3', num: 5, url: '/audio/playlist-2/5 Forgotten Glade.mp3' },
    { name: "Le Bois d'Ombre", filename: '6 The Gloomwood.mp3', num: 6, url: '/audio/playlist-2/6 The Gloomwood.mp3' },
    { name: 'Siège Silencieux', filename: '7 Silent Siege.mp3', num: 7, url: '/audio/playlist-2/7 Silent Siege.mp3' },
    { name: 'Calcul Glacial', filename: '8 Cold Calculus.mp3', num: 8, url: '/audio/playlist-2/8 Cold Calculus.mp3' },
    { name: "Terreur d'Obsidienne", filename: '9 Obsidian Dread .mp3', num: 9, url: '/audio/playlist-2/9 Obsidian Dread .mp3' },
    { name: 'Siège de Cendres', filename: '91 Siege of Ashes .mp3', num: 10, url: '/audio/playlist-2/91 Siege of Ashes .mp3' },
  ],
};
