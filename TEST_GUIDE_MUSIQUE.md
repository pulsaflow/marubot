# 🧪 Guide de Test Rapide - Module Musique

## Avant de Commencer

### ✅ Vérifications Préliminaires

1. **Variables d'environnement** :
   ```powershell
   # Vérifier que FFMPEG_PATH est défini
   echo $env:FFMPEG_PATH
   # Devrait afficher : C:\Users\...\ffmpeg.exe
   ```

2. **Dépendances installées** :
   ```powershell
   npm list @discordjs/voice discord-player @discord-player/extractor play-dl
   # Vérifier : @discordjs/voice@0.17.0 (exactement 0.17.0, pas 0.19.0)
   ```

3. **Build du projet** :
   ```powershell
   npm run build
   # OU pour dev :
   npm run dev
   ```

---

## 🎯 Tests Essentiels

### Test #1 : Démarrage du Bot

**Commande** :
```powershell
npm run dev
```

**Logs Attendus** :
```
✅ libsodium-wrappers chargé et initialisé
✅ tweetnacl chargé et rendu global
✅ Attente initialisation @discordjs/voice terminée
✅ FFmpeg trouvé et accessible: C:\Users\...\ffmpeg.exe
✅ Chemin FFmpeg configuré: C:\Users\...\ffmpeg.exe
🔄 Chargement des extracteurs...
✅ YouTubeExtractor officiel enregistré (@discord-player/extractor)
✅ Spotify extractor enregistré
✅ 2 extracteur(s) chargé(s) avec succès
```

**❌ Si vous voyez** :
- `⚠️ FFMPEG_PATH non défini` → Ajouter la variable d'environnement
- `❌ ERREUR: Impossible d'enregistrer YouTubeExtractor` → Problème avec @discord-player/extractor
- `❌ Erreur API YouTube 400` → play-dl doit être mis à jour

---

### Test #2 : Commande `/play` - Première Track

**Étapes** :
1. Rejoindre un canal vocal sur Discord
2. Taper `/play never gonna give you up`
3. Attendre la réponse du bot

**Logs Attendus** :
```
[joinVoiceChannel] Création queue pour <Serveur>
[joinVoiceChannel] Connexion à <Canal>
[joinVoiceChannel] ✅ Connexion établie (ready)
🔍 Recherche: 1 track(s) trouvée(s) pour "never gonna give you up"
[PLAY] État avant ajout: wasEmpty=true, connection=ready
✅ Track ajoutée: Rick Astley - Never Gonna Give You Up
[PLAY] Queue était vide, démarrage immédiat de la lecture...
[discord-player DEBUG] Stream extraction was successful for Track { title: ... }
[discord-player DEBUG] Preparing AudioResource...
[discord-player DEBUG] Initializing audio player...
[PLAY] ✅ Lecture démarrée avec succès

🎵🎵🎵 [EVENT playerStart] DÉCLENCHÉ ! 🎵🎵🎵
   Track: Rick Astley - Never Gonna Give You Up
   Guild: <Serveur>
   isPlaying: true
```

**Résultat Discord** :
- Le bot rejoint le canal vocal
- Un embed s'affiche : "✅ Ajouté à la file d'attente" avec le titre de la musique
- **LA MUSIQUE COMMENCE À JOUER** 🎵

**❌ Si vous voyez** :
- `[PLAY] ❌ Erreur démarrage manuel` → Vérifier que FFmpeg est accessible
- Pas de son mais le bot est connecté → Vérifier que `playerStart` se déclenche
- `[EVENT playerStart]` ne se déclenche jamais → Problème avec l'extraction du stream

---

### Test #3 : Ajout à la Queue

**Étapes** :
1. Une musique est en cours de lecture (Test #2)
2. Taper `/play bohemian rhapsody`

**Logs Attendus** :
```
🔍 Recherche: 1 track(s) trouvée(s) pour "bohemian rhapsody"
[PLAY] État avant ajout: wasEmpty=false, connection=ready
✅ Track ajoutée: Queen - Bohemian Rhapsody
[PLAY] Track ajoutée à la queue existante (1 track(s) en attente)
```

**Résultat Discord** :
- Embed : "✅ Ajouté à la file d'attente" avec position dans la queue
- La musique actuelle continue de jouer
- La nouvelle musique jouera après

**❌ Si vous voyez** :
- `⚠️ Play() déjà en cours` → Attendez quelques secondes et réessayez

---

### Test #4 : Commandes de Contrôle

**Commandes à Tester** :
```
/pause     → La musique se met en pause / reprend
/skip      → Passe à la musique suivante
/stop      → Arrête la musique et quitte le canal
/volume 70 → Change le volume à 70%
/queue     → Affiche la file d'attente
```

**Résultat Attendu** :
- Chaque commande répond avec un embed
- Aucune erreur "Interaction has already been acknowledged"
- Les actions se déroulent correctement

---

### Test #5 : Gestion d'Erreurs

**Étapes** :
1. Taper `/play https://www.youtube.com/watch?v=VIDEO_PRIVEE`
   (ou n'importe quelle vidéo privée/indisponible)

**Logs Attendus** :
```
❌ Erreur API YouTube 400 - L'extracteur YouTube ne peut pas obtenir le stream
💡 Solution possible: Vérifier que play-dl est à jour ou que la vidéo est accessible
```

**Résultat Discord** :
- Embed d'erreur affiché à l'utilisateur
- Pas de crash du bot
- La queue continue normalement

---

## 🔍 Diagnostic des Problèmes

### Problème : Pas de Son

**Vérifications** :
1. ✅ Le bot est-il connecté au canal vocal ?
2. ✅ `playerStart` se déclenche-t-il ?
   ```
   🎵🎵🎵 [EVENT playerStart] DÉCLENCHÉ ! 🎵🎵🎵
   ```
3. ✅ FFmpeg est-il accessible ?
   ```
   ✅ FFmpeg trouvé et accessible: ...
   ```
4. ✅ La connexion est-elle `ready` ?
   ```
   [joinVoiceChannel] ✅ Connexion établie (ready)
   ```

**Si playerStart ne se déclenche jamais** :
- Problème avec l'extracteur (play-dl ou @discord-player/extractor)
- Problème avec le stream audio
- Vérifier les logs discord-player DEBUG entre "Preparing AudioResource" et playerStart

---

### Problème : "Interaction has already been acknowledged"

**Cause** : Une commande a encore un `deferReply()` en doublon.

**Solution** :
1. Identifier la commande problématique dans l'erreur
2. Ouvrir le fichier correspondant dans `src/commands/music/`
3. Vérifier qu'il n'y a PAS de `await interaction.deferReply()` dans `execute()`
4. Remplacer par le commentaire :
   ```typescript
   // NOTE: deferReply() est déjà fait dans interactionCreate.ts
   ```

---

### Problème : "kill EPERM"

**C'est Normal !** Cette erreur est ignorée automatiquement.

**Logs Attendus** :
```
⚠️ Erreur kill EPERM ignorée (nettoyage FFmpeg sur Windows - non critique)
```

Cela n'affecte PAS la lecture de la musique. C'est juste Windows qui refuse de tuer proprement le processus FFmpeg lors du cleanup.

---

### Problème : "No compatible encryption modes"

**Cause** : Version de @discordjs/voice trop récente (0.19.0).

**Solution** :
```powershell
npm install @discordjs/voice@0.17.0 --save-exact
npm run build
```

**Vérifier** :
```powershell
npm list @discordjs/voice
# Devrait afficher : @discordjs/voice@0.17.0
```

---

## 📊 Logs de Référence

### ✅ Démarrage Réussi (Complet)
```
✅ libsodium-wrappers chargé et initialisé
✅ tweetnacl chargé et rendu global
✅ Attente initialisation @discordjs/voice terminée
Bot Discord en cours de démarrage...
✅ FFmpeg trouvé et accessible: C:\Users\...\ffmpeg.exe
✅ Chemin FFmpeg configuré: C:\Users\...\ffmpeg.exe
🔄 Chargement des extracteurs...
✅ YouTubeExtractor officiel enregistré (@discord-player/extractor)
✅ Spotify extractor enregistré
✅ 2 extracteur(s) chargé(s) avec succès
   - com.discord-player.youtubeextractor: YouTubeExtractor
   - com.discord-player.spotifyextractor: SpotifyExtractor
Bot connecté en tant que MaruBot#1234
Prêt à servir 5 serveurs
```

---

### ✅ Lecture Réussie (Complet)
```
[joinVoiceChannel] Création queue pour Mon Serveur
[joinVoiceChannel] Connexion à Général
[joinVoiceChannel] ✅ Connexion établie (ready)
🔍 Recherche: 1 track(s) trouvée(s) pour "never gonna give you up"
[PLAY] État avant ajout: wasEmpty=true, connection=ready
✅ Track ajoutée: Rick Astley - Never Gonna Give You Up
[PLAY] Queue était vide, démarrage immédiat de la lecture...
[discord-player DEBUG] Stream extraction was successful for Track { title: 'Rick Astley - Never Gonna Give You Up', ... } (Extractor: com.discord-player.youtubeextractor)
[discord-player DEBUG] Preparing AudioResource...
[discord-player DEBUG] Initializing audio player...
[PLAY] ✅ Lecture démarrée avec succès

🎵🎵🎵 [EVENT playerStart] DÉCLENCHÉ ! 🎵🎵🎵
   Track: Rick Astley - Never Gonna Give You Up
   Guild: Mon Serveur
   isPlaying: true
🎵 [EVENT playerStart] Lecture démarrée: Rick Astley - Never Gonna Give You Up dans Mon Serveur
   - isPlaying: true
   - connection.status: ready
   - dispatcher: EXISTS
```

---

## 🎯 Checklist Finale

Avant de considérer le module musique comme fonctionnel, vérifiez :

- [ ] Le bot démarre sans erreur critique
- [ ] FFmpeg est détecté et accessible
- [ ] Les extracteurs YouTube et Spotify sont chargés
- [ ] `/play <musique>` fait jouer la musique immédiatement
- [ ] `playerStart` se déclenche à chaque nouvelle musique
- [ ] Le son est audible dans Discord
- [ ] `/skip`, `/pause`, `/stop` fonctionnent correctement
- [ ] Aucune erreur "Interaction has already been acknowledged"
- [ ] Les erreurs "kill EPERM" sont ignorées (normal)
- [ ] Ajout à la queue fonctionne (plusieurs musiques)
- [ ] Les playlists YouTube fonctionnent

---

## 🆘 Support

Si après tous ces tests le module ne fonctionne toujours pas :

1. **Vérifier les versions** :
   ```powershell
   npm list @discordjs/voice discord-player @discord-player/extractor play-dl
   ```

2. **Nettoyer et réinstaller** :
   ```powershell
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. **Vérifier les logs complets** :
   - Chercher toutes les erreurs (pas seulement les critiques)
   - Vérifier que playerStart se déclenche
   - Vérifier l'état de la connexion vocale

4. **Tester sur un autre serveur Discord** :
   - Parfois les permissions du serveur peuvent bloquer

---

**Bonne chance ! 🎵**
