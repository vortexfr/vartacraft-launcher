# Vartacraft Launcher

Launcher Minecraft Forge 1.20.1 pour le serveur Vartacraft.

---

## Prérequis

- [Node.js 20+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [npm](https://www.npmjs.com/) (inclus avec Node.js)

---

## Installation du projet

```bash
git clone https://github.com/vortexfr/vartacraft-launcher.git
cd vartacraft-launcher
npm install
```

---

## Lancer en développement

```bash
npm run dev
```

Ouvre le launcher en mode dev avec rechargement automatique.

---

## Build & Package

### Windows (depuis Windows uniquement)
```bash
npm run package
# ou
npm run package:win
```
Génère `dist/Vartacraft Launcher Setup x.x.x.exe`

### Mac (depuis macOS uniquement)
```bash
npm run package:mac
```
Génère `dist/Vartacraft Launcher-x.x.x.dmg`

### Linux (depuis Linux uniquement)
```bash
npm run package:linux
```
Génère `dist/Vartacraft Launcher-x.x.x.AppImage`

### Build toutes plateformes — GitHub Actions (recommandé)
Voir section ci-dessous.

---

## Publier une nouvelle version

### 1. Modifier la version
Dans `package.json`, incrémenter `"version"` :
```json
"version": "2.0.2"
```

### 2. Commit et push
```bash
git add .
git commit -m "v2.0.2"
git push
```

### 3. Créer un tag (déclenche le build automatique)
```bash
git tag v2.0.2
git push origin v2.0.2
```

GitHub Actions va automatiquement build Windows + Mac + Linux en parallèle.
Les fichiers sont téléchargeables dans **Actions → ton build → Artifacts**.

---

## GitHub Actions — Build automatique

Le workflow `.github/workflows/build.yml` se déclenche :
- À chaque tag `v*` (ex: `v2.0.2`)
- Manuellement via **Actions → Build Launcher → Run workflow**

| Job | OS | Fichier généré |
|-----|----|----------------|
| build-windows | windows-latest | `.exe` |
| build-mac | macos-latest | `.dmg` |
| build-linux | ubuntu-latest | `.AppImage` |

---

## Système de mise à jour du launcher

Le launcher vérifie automatiquement les mises à jour au démarrage en comparant
le fichier `version.json` sur `https://launcher.ouiweb.eu/launcher/`.

Format de `version.json` à héberger sur le serveur :
```json
{
  "version": "2.0.2",
  "url": "https://ton-serveur.fr/VartacraftLauncherSetup-2.0.2.exe"
}
```

Quand une nouvelle version est détectée, le launcher affiche une popup
et ouvre le lien de téléchargement.

---

## Structure du projet

```
vartacraft-launcher/
├── electron/
│   ├── main.js          # Processus principal Electron (install, launch, IPC)
│   └── preload.js       # Bridge IPC renderer ↔ main
├── src/
│   ├── assets/          # Images et icônes
│   ├── pages/           # Pages React (Home, Splash, Settings, Credits...)
│   ├── App.jsx          # Routeur de pages
│   └── index.css        # Thème global
├── build/
│   └── license.txt      # Conditions affichées dans l'installeur
├── .github/
│   └── workflows/
│       └── build.yml    # GitHub Actions
└── package.json
```

---

## Serveur de ressources

Les fichiers suivants doivent être hébergés sur `https://launcher.ouiweb.eu/mod/` :

| Fichier | Description |
|---------|-------------|
| `jdk17.zip` | Java 17 (JDK portable) |
| `natives.zip` | Natives LWJGL pour Forge 1.20.1 |
| `*.jar` | Mods du serveur |

---

## Commandes utiles

```bash
npm run dev          # Développement
npm run build        # Build Vite uniquement (sans Electron)
npm run package      # Package Windows
npm run package:win  # Package Windows
npm run package:mac  # Package Mac (macOS requis)
npm run package:linux # Package Linux
```

---

## Publier une version (commande rapide)

Modifier la version dans `package.json`, puis :

```bash
git add .
git commit -m "v1.0.1"
git push
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions build automatiquement Windows + Mac + Linux.