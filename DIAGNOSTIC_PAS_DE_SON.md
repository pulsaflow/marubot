# 🔍 DIAGNOSTIC AVANCÉ - Pas de Son

## 🎯 Modifications Appliquées

J'ai ajouté **3 niveaux de diagnostic critique** pour identifier pourquoi il n'y a pas de son :

### 1️⃣ Configuration FFmpeg Forcée
```typescript
skipFFmpeg: false,  // OBLIGATOIRE - Force le transcodage avec FFmpeg
useLegacyFFmpeg: false,  // Utilise la nouvelle API FFmpeg
```

### 2️⃣ Diagnostic Détaillé dans `playerStart`
Logs automatiques de :
- État de l'audio player (`playing`, `idle`, `buffering`)
- Présence de l'AudioResource
- **Volume** (si = 0, aucun son ne sera audible)

### 3️⃣ Diagnostic AVANT et APRÈS `queue.node.play()`
Logs complets de l'état de la queue à chaque étape.

---

## 🚀 Étapes de Test

### 1. Redémarrer le Bot
```powershell
# Arrêter le bot actuel (Ctrl+C)
npm run dev
```

### 2. Utiliser `/play`
```
/play never gonna give you up
```

### 3. Analyser les Logs

#### ✅ **Logs de Démarrage Attendus**
```
✅ FFmpeg trouvé et accessible: C:\Users\...\ffmpeg.exe
✅ Chemin FFmpeg configuré: C:\Users\...\ffmpeg.exe
```

#### ✅ **Logs de Connexion Attendus**
```
[joinVoiceChannel] Queue créée avec volume: 50%
[joinVoiceChannel] Connexion à <Canal>
[joinVoiceChannel] ✅ Connexion établie (ready)
```

#### 🔍 **Logs de Diagnostic AVANT PLAY**
```
🔍 [DIAGNOSTIC AVANT PLAY]
  - tracks.size: 1
  - currentTrack: NULL        ← Normal avant play()
  - connection.status: ready  ← DOIT être "ready"
  - volume: 50                ← DOIT être > 0
  - isPlaying: false          ← Normal avant play()
  - isPaused: false
```

#### 🔍 **Logs de Diagnostic APRÈS PLAY**
```
[PLAY] ✅ Lecture démarrée avec succès

🔍 [DIAGNOSTIC APRÈS PLAY]
  - currentTrack: <Titre>           ← DOIT exister
  - isPlaying: true                 ← DOIT être true
  - isPaused: false
  - dispatcher: EXISTS              ← DOIT exister
  - audioPlayer.state.status: playing   ← CRITIQUE: Doit être "playing"
  - audioPlayer.state.resource: EXISTS  ← CRITIQUE: Doit exister
```

#### 🎵 **Logs playerStart**
```
🎵🎵🎵 [EVENT playerStart] DÉCLENCHÉ ! 🎵🎵🎵
   Track: <Titre>
   Guild: <Serveur>
   isPlaying: true
🎵 [EVENT playerStart] Lecture démarrée: <Titre> dans <Serveur>
   - isPlaying: true
   - connection.status: ready
   - dispatcher: EXISTS
   - audioPlayer.state.status: playing      ← CRITIQUE
   - audioPlayer.state.resource: EXISTS     ← CRITIQUE
   - volume: 50%                            ← CRITIQUE
```

---

## 🔴 Problèmes Possibles et Solutions

### Problème #1 : `volume: 0%`

**Symptôme** :
```
- volume: 0%
❌ VOLUME EST À 0 ! Aucun son ne sera audible
```

**Solution** :
```
/volume 50
```

Ou modifier dans la base de données :
```sql
UPDATE MusicConfig SET defaultVolume = 50 WHERE guildId = '<ID>';
```

---

### Problème #2 : `audioPlayer.state.status: idle` ou `buffering`

**Symptôme** :
```
- audioPlayer.state.status: idle
```

**Cause** : L'audio player n'a pas démarré ou s'est arrêté immédiatement.

**Solutions Possibles** :
1. **FFmpeg n'est pas accessible** :
   - Vérifier que `FFMPEG_PATH` pointe vers le bon fichier
   - Tester : `C:\Users\...\ffmpeg.exe -version` dans PowerShell

2. **Le stream est corrompu** :
   - Problème avec l'extracteur YouTube (play-dl)
   - Essayer une autre vidéo

3. **@discordjs/opus manquant** :
   ```powershell
   npm list @discordjs/opus
   # Si pas installé :
   npm install @discordjs/opus
   ```

---

### Problème #3 : `audioPlayer.state.resource: NULL`

**Symptôme** :
```
- audioPlayer.state.resource: NULL
```

**Cause CRITIQUE** : **Aucun AudioResource créé** = Pas de stream audio.

**Solutions** :
1. **Vérifier que FFmpeg est utilisé** :
   - Dans les logs, chercher `skipFFmpeg: false`
   - Si `skipFFmpeg: true`, le problème vient de là

2. **Mettre à jour play-dl** :
   ```powershell
   npm update play-dl
   ```

3. **Essayer avec youtube-dl-exec** (alternative) :
   ```powershell
   npm install youtube-dl-exec
   ```

---

### Problème #4 : `dispatcher: NULL`

**Symptôme** :
```
- dispatcher: NULL
❌ audioPlayer: NULL - PAS DE SON ATTENDU
```

**Cause** : **Discord-player n'a pas créé le dispatcher**.

**Solutions** :
1. **Downgrade discord-player** :
   ```powershell
   npm install discord-player@6.6.8
   ```

2. **Vérifier @discordjs/voice** :
   ```powershell
   npm list @discordjs/voice
   # DOIT être 0.17.0, pas 0.19.0
   ```

---

### Problème #5 : `connection.status: connecting` ou `signalling`

**Symptôme** :
```
- connection.status: connecting
```

**Cause** : La connexion vocale n'est pas encore établie.

**Solution** : Augmenter le délai dans `joinVoiceChannel()` :
```typescript
// Au lieu de 500ms :
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## 🔧 Tests Additionnels

### Test Manuel FFmpeg
```powershell
# Remplacer par votre chemin FFmpeg
C:\Users\...\ffmpeg.exe -version

# Devrait afficher :
# ffmpeg version N-...
# built with gcc ...
```

### Test Manuel Opus
```powershell
npm list @discordjs/opus node-opus opusscript

# Au moins un doit être installé
```

### Test Manuel play-dl
```powershell
node
> const playdl = require('play-dl');
> playdl.video_basic_info('https://www.youtube.com/watch?v=dQw4w9WgXcQ').then(console.log);
# Devrait afficher les infos de la vidéo
```

---

## 📊 Checklist de Diagnostic

Après avoir utilisé `/play`, vérifiez :

- [ ] ✅ FFmpeg détecté au démarrage
- [ ] ✅ Connexion vocale `ready`
- [ ] ✅ Volume > 0 (afficher dans diagnostic)
- [ ] ✅ `playerStart` se déclenche
- [ ] ✅ `audioPlayer.state.status: playing`
- [ ] ✅ `audioPlayer.state.resource: EXISTS`
- [ ] ✅ `dispatcher: EXISTS`
- [ ] ✅ `isPlaying: true`
- [ ] ❌ **Pas de son** ← Si tous les ✅ ci-dessus sont OK et toujours pas de son

---

## 🆘 Si Tous les Logs Sont OK mais Toujours Pas de Son

### Vérifications Discord
1. **Le bot est-il muté dans Discord ?**
   - Clic droit sur le bot → Vérifier qu'il n'est pas muté
   
2. **Le volume du bot est-il à 0 dans Discord ?**
   - Clic droit sur le bot → Augmenter le curseur de volume

3. **Vos haut-parleurs/casque sont-ils actifs ?**
   - Tester avec un autre bot de musique (Rythm, Groovy, etc.)

4. **Le serveur Discord a-t-il des restrictions ?**
   - Certains serveurs limitent les bots vocaux

### Vérifications Système
1. **Windows Audio Service actif ?**
   ```powershell
   Get-Service Audiosrv
   # Status devrait être "Running"
   ```

2. **Périphérique audio par défaut ?**
   - Paramètres → Son → Vérifier le périphérique de sortie

---

## 📝 Prochaines Actions

### Si `volume: 0%`
→ Utiliser `/volume 50`

### Si `audioPlayer: NULL` ou `resource: NULL`
→ Problème FFmpeg ou extracteur
→ Vérifier FFmpeg manuellement
→ Mettre à jour play-dl

### Si `connection.status: connecting`
→ Augmenter le délai d'attente

### Si TOUT est OK mais pas de son
→ Problème Discord ou système
→ Tester avec un autre bot
→ Vérifier les paramètres audio Windows

---

**Exécutez `/play` maintenant et copiez-moi TOUS les logs de diagnostic !**
