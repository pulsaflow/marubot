# 🎵 Code Complet du Module Musique - MaruBot

**Date de génération :** 2025-12-07  
**Problème actuel :** `Maximum call stack size exceeded` lors de `queue.node.play()`

---

## 📁 Fichiers inclus

1. `src/services/MusicService.ts` - Service principal de musique
2. `src/commands/music/play.ts` - Commande `/play`
3. `src/events/interactionCreate.ts` - Handler des interactions
4. `src/core/Bot.ts` - Classe principale du bot
5. `src/index.ts` - Point d'entrée

---

## 1. MusicService.ts

```typescript
${file_contents_MusicService}
```

---

## 2. play.ts

```typescript
${file_contents_play}
```

---

## 3. interactionCreate.ts (extrait - partie musique)

```typescript
${file_contents_interactionCreate}
```

---

## 4. Bot.ts

```typescript
${file_contents_Bot}
```

---

## 5. index.ts (extrait)

```typescript
${file_contents_index}
```

---

## 🔍 Problème identifié

**Erreur :** `Maximum call stack size exceeded`  
**Quand :** Immédiatement après `queue.node.play()`  
**Logs :**
```
[play.ts] Appel queue.node.play() - Track unique: ...
[play.ts] État AVANT: isPlaying=false, isPaused=false, size=1
[play.ts] Connection status: EXISTS
⚠️ Maximum call stack size exceeded
```

**Hypothèses :**
1. `queue.node.play()` déclenche une sérialisation Discord.js qui contient des références circulaires
2. Les métadonnées de la queue (`queue.metadata`) pourraient contenir des références circulaires
3. Un event handler (`playerStart`, `audioTrackAdd`, etc.) pourrait déclencher une récursion

**Tentatives de correction :**
- ✅ Suppression des accès à `queue.connection?.channel?.name` dans les logs
- ✅ Utilisation de `process.nextTick()` pour rendre `play()` asynchrone
- ✅ Protection avec `playingGuilds` Set
- ✅ Handler `playerStart` réactivé temporairement pour diagnostic
- ❌ **La récursion persiste**

---

## 💡 Recommandations pour analyse

1. **Vérifier les métadonnées de la queue :**
   - Ligne 367-371 de `MusicService.ts` : `metadata` contient seulement `channelId` et `guildId` (strings)
   - Mais discord-player pourrait ajouter d'autres métadonnées automatiquement

2. **Vérifier les event handlers :**
   - Ligne 49-66 de `MusicService.ts` : handlers `playerStart`, `audioTrackAdd`, `audioTracksAdd`
   - Ces handlers pourraient être appelés pendant `play()` et causer récursion

3. **Vérifier la sérialisation Discord.js :**
   - `queue.node.play()` pourrait tenter de sérialiser la queue complète
   - Les objets `Track` pourraient contenir des références circulaires

4. **Vérifier discord-player lui-même :**
   - Le problème pourrait venir de la bibliothèque `discord-player`
   - Version utilisée ? Vérifier les issues GitHub connues

---

## 📋 Prochaines étapes suggérées

1. **Désactiver TOUS les event handlers** temporairement et tester
2. **Créer une queue vide** avec `metadata` complètement vide
3. **Vérifier la version de discord-player** et ses dépendances
4. **Tester avec une version minimale** de discord-player sans extracteurs
5. **Vérifier si FFmpeg** est correctement installé

---

## 📝 Notes techniques

- **Node.js :** v20+
- **Discord.js :** v14+
- **discord-player :** (vérifier version dans package.json)
- **discord-player-youtubei :** utilisé pour extracteur YouTube stable
- **Architecture :** ESM (ECMAScript Modules)

