# InkaNetopology - Scanner Réseau Local & Cartographie Interactive

**InkaNetopology** est une application web conteneurisée sous Docker conçue pour scanner le réseau local (LAN), identifier automatiquement les équipements connectés, modéliser avec précision leurs relations physiques et de virtualisation (machines physiques, machines virtuelles, conteneurs Docker, objets connectés IoT), et fournir une journalisation en temps réel dans une interface soignée avec mode sombre.

---

## Sommaire

1. [Fonctionnalités Clés](#1-fonctionnalités-clés)
2. [Où se trouve l'image du conteneur ?](#2-où-se-trouve-limage-du-conteneur-)
3. [Architecture Technique](#3-architecture-technique)
4. [Prérequis Système](#4-prérequis-système)
5. [Fichier Docker Compose](#5-fichier-docker-compose)
6. [Guide d'Installation Pas à Pas](#6-guide-dinstallation-pas-à-pas)
   - [Méthode 1 : Déploiement avec Docker Compose (Recommandé)](#méthode-1--déploiement-avec-docker-compose-recommandé)
   - [Méthode 2 : Lancement direct en ligne de commande (Docker CLI)](#méthode-2--lancement-direct-en-ligne-de-commande-docker-cli)
   - [Méthode 3 : Compilation et Build local depuis les sources](#méthode-3--compilation-et-build-local-depuis-les-sources)
7. [Guide d'Utilisation](#7-guide-dutilisation)
   - [7.1 Accès à l'interface](#71-accès-à-linterface)
   - [7.2 Lancer un scan réseau](#72-lancer-un-scan-réseau)
   - [7.3 Cartographie interactive (Topologie Réseau)](#73-cartographie-interactive-topologie-réseau)
   - [7.4 Vue Hôtes & Dépendances de Virtualisation](#74-vue-hôtes--dépendances-de-virtualisation)
   - [7.5 Personnalisation graphique et métadonnées d'un équipement](#75-personnalisation-graphique-et-métadonnées-dun-équipement)
   - [7.6 Inventaire détaillé et filtrage dynamique](#76-inventaire-détaillé-et-filtrage-dynamique)
   - [7.7 Journalisation en temps réel (SSE)](#77-journalisation-en-temps-réel-sse)
   - [7.8 Export de la configuration](#78-export-de-la-configuration)
8. [Intégration Reverse Proxy (HTTPS)](#8-intégration-reverse-proxy-https)
9. [Dépannage & FAQ](#9-dépannage--faq)

---

## 1. Fonctionnalités Clés

- **Détection Automatique & Scan Multi-Modes** :
  - Découverte des sous-réseaux locaux (ex: `192.168.1.0/24`, `10.0.0.0/24`).
  - Balayage ARP broadcast, requêtes ICMP et sondage des ports de services (HTTP, HTTPS, SSH, Proxmox VE 8006, RTSP 554, MQTT 1883, etc.).
  - 3 modes de scan : *Découverte Rapide*, *Scan Approfondi (Services & Ports)*, *Audit Spécialisé IoT & Domotique*.
  - Reconnaissance automatique des fabricants matériels via les préfixes OUI (Ubiquiti, Dell, Synology, Raspberry Pi, Hikvision, Espressif, Philips Hue, Shelly, etc.).
- **Différenciation Visuelle Réaliste** :
  - **Physique** : passerelles/routeurs, switches manageables, serveurs rack, NAS, postes bureautiques.
  - **Machines Virtuelles (VM)** : nœuds QEMU/KVM Proxmox et VMware.
  - **Conteneurs Docker** : microservices avec nom de conteneur, liaisons `veth` et ports publiés.
  - **Périphériques IoT** : caméras IP 4K RTSP, capteurs de présence radar mmWave, sondes de température/humidité, prises connectées wattmètres.
- **Modélisation Dynamique des Dépendances** :
  - Liaisons physiques réseau (câbles Ethernet avec indication du port et débit, ou liaisons Wi-Fi).
  - Liaisons de virtualisation dynamiques (courbes en pointillés reliant les VMs et conteneurs à leur hôte physique respectif).
  - Possibilité de modifier ou réassigner à chaud l'hôte parent de n'importe quelle VM ou conteneur.
- **Personnalisation Complète** :
  - Ajout d'images personnalisées (URL d'images réelles de matériel ou préréglages haute-fidélité).
  - Étiquettes contextuelles libres (*Tags* : `Production`, `DMZ`, `VLAN 20`, `Critique`, etc.).
  - Métadonnées techniques clé-valeur (CPU, RAM, consommation électrique en watts, firmware, flux RTSP).
- **Journalisation en Temps Réel** :
  - Flux d'événements continus via Server-Sent Events (SSE).
  - Filtrage par niveau (`DISCOVERY`, `INFO`, `WARN`, `ALERT`) et par catégorie (`ARP`, `PORT`, `DOCKER`, `VM`, `IOT`, `SYSTEM`).
- **Interface Réactive & Mode Sombre** :
  - Design moderne sans fioritures superflues, typographie soignée (`Plus Jakarta Sans` et `JetBrains Mono` pour les données tabulaires).

---

## 2. Où se trouve l'image du conteneur ?

L'image Docker de l'application peut résider à deux endroits selon votre mode d'utilisation :

### 1. Construction locale (sur votre machine hôte)
L'image est construite directement depuis le fichier `Dockerfile` situé à la racine du projet avec la commande :
```bash
docker build -t inkatypik/inkanetopology:latest .
```
Dans ce cas :
- L'image est stockée localement dans le stockage interne de votre moteur Docker (habituellement situé dans `/var/lib/docker/overlay2` sous Linux).
- Elle apparaît dans la liste locale de vos images lorsque vous exécutez `docker images` sous le nom **`inkatypik/inkanetopology:latest`**.

### 2. Registre distant Docker Hub / GHCR (Déploiement direct)
Si vous publiez ou téléchargez l'image depuis un registre conteneurs :
- **Identifiant officiel / canonique** : `inkatypik/inkanetopology:latest`
- **Pour télécharger l'image prête à l'emploi** :
  ```bash
  docker pull inkatypik/inkanetopology:latest
  ```
- **Pour publier votre image personnalisée** :
  ```bash
  docker push inkatypik/inkanetopology:latest
  ```

---

## 3. Architecture Technique

- **Frontend** : React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas SVG dynamique.
- **Backend** : Node.js, Express, Server-Sent Events (SSE) pour le flux live, inspection des interfaces réseau locales via l'API `os` et `/proc/net/arp`.
- **Conteneurisation** : Image Docker multi-stage basée sur `node:22-alpine` avec paquet `iproute2` pour la manipulation des interfaces réseau.

---

## 4. Prérequis Système

- Un système d'exploitation hôte Linux (Debian, Ubuntu Server, Proxmox VE, Raspberry Pi OS, Synology DSM avec Docker, TrueNAS SCALE, etc.).
- **Docker Engine** (version 24.0 ou supérieure).
- **Docker Compose** (version v2.20 ou supérieure).
- Droits `sudo` ou utilisateur appartenant au groupe `docker`.
- Le port `3000` libre sur la machine hôte (ou personnalisable via la variable `PORT`).

---

## 5. Fichier Docker Compose

Voici le fichier `docker-compose.yml` complet et optimisé :

```yaml
services:
  inkanetopology:
    build:
      context: .
      dockerfile: Dockerfile
    image: inkatypik/inkanetopology:latest
    container_name: inkanetopology-scanner
    restart: unless-stopped

    # CRITIQUE: Le mode 'host' permet au conteneur de partager directement
    # les interfaces réseau physiques de la machine hôte. Cela est nécessaire
    # pour envoyer des requêtes ARP broadcast sur le LAN et recevoir les paquets
    # mDNS/SSDP des équipements IoT sans subir l'isolation NAT de Docker.
    network_mode: host

    # Capacités Linux nécessaires pour forger des raw sockets (ping ICMP / ARP)
    cap_add:
      - NET_ADMIN
      - NET_RAW

    environment:
      - NODE_ENV=production
      - PORT=3000

    volumes:
      # Montage en lecture seule de la table ARP et des interfaces noyau Linux
      - /proc/net:/proc/net:ro
      - /sys/class/net:/sys/class/net:ro
      # Montage en lecture seule du socket Docker pour l'inventaire dynamique des conteneurs
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Explications des directives importantes :

| Directive | Utilité |
| :--- | :--- |
| `network_mode: host` | Indispensable pour un scanner réseau. Un conteneur en mode `bridge` standard se trouve confiné dans son sous-réseau virtuel (ex: `172.17.0.0/16`) et ne peut pas émettre de broadcasts ARP vers votre réseau physique local (`192.168.1.x`). |
| `cap_add: [NET_ADMIN, NET_RAW]` | Autorise le conteneur à forger des trames ICMP (ping) et à interroger les interfaces réseau physiques avec des sockets bruts. |
| `/proc/net:/proc/net:ro` | Permet à l'application de lire directement `/proc/net/arp` de l'hôte pour obtenir la liste instantanée des adresses MAC et IPs déjà connues par le noyau Linux. |
| `/var/run/docker.sock:/var/run/docker.sock:ro` | Permet au scanner d'identifier les conteneurs Docker s'exécutant sur le serveur hôte et de les rattacher dynamiquement dans la cartographie. |

---

## 6. Guide d'Installation Pas à Pas

### Méthode 1 : Déploiement avec Docker Compose (Recommandé)

1. **Créer le répertoire de travail** :
   ```bash
   mkdir -p /opt/inkanetopology && cd /opt/inkanetopology
   ```

2. **Créer le fichier `docker-compose.yml`** :
   Copiez le contenu de la section 5 dans un fichier nommé `docker-compose.yml`.

3. **Télécharger le code source ou construire l'image** :
   Si vous disposez du code source dans ce dossier :
   ```bash
   docker compose build
   ```

4. **Démarrer l'application en arrière-plan** :
   ```bash
   docker compose up -d
   ```

5. **Vérifier l'état du conteneur** :
   ```bash
   docker compose ps
   docker compose logs -f
   ```

---

### Méthode 2 : Lancement direct en ligne de commande (Docker CLI)

Si vous ne souhaitez pas utiliser de fichier Compose, vous pouvez lancer le conteneur en une seule commande :

```bash
docker run -d \
  --name inkanetopology-scanner \
  --restart unless-stopped \
  --net=host \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  -v /proc/net:/proc/net:ro \
  -v /sys/class/net:/sys/class/net:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e PORT=3000 \
  -e NODE_ENV=production \
  inkatypik/inkanetopology:latest
```

---

### Méthode 3 : Compilation et Build local depuis les sources

Pour compiler et lancer l'application directement depuis les sources sans conteneur :

```bash
# 1. Cloner le dépôt et installer les dépendances
git clone <url-du-depot>
cd inkanetopology
npm install

# 2. Lancer en mode développement (avec rechargement à chaud)
npm run dev

# 3. Ou compiler pour la production
npm run build
npm start
```

---

## 7. Guide d'Utilisation

### 7.1 Accès à l'interface

Une fois le conteneur démarré, ouvrez votre navigateur web et accédez à :
```text
http://<ADRESSE_IP_DU_SERVEUR>:3000
```
*(Par exemple : `http://192.168.1.10:3000`)*.

---

### 7.2 Lancer un scan réseau

1. **Vérifier le sous-réseau** :
   Dans la barre d'outils supérieure, le champ **Sous-réseau** affiche automatiquement le masque détecté sur votre machine hôte (ex: `192.168.1.0/24`). Vous pouvez le modifier si vous souhaitez scanner un autre VLAN ou segment réseau (ex: `192.168.20.0/24`).
2. **Choisir le mode de scan** :
   - **Découverte Rapide (ARP/ICMP)** : Balayage express pour repérer les machines allumées et récupérer leurs adresses MAC.
   - **Scan Approfondi (Ports & OS)** : Interroge les ports d'administration courants (SSH, HTTP, HTTPS, Proxmox, NAS, etc.) pour déterminer l'OS et les services.
   - **Audit Spécialisé IoT & Domotique** : Recherche ciblée sur les flux RTSP (caméras de surveillance), les brokers MQTT (Mosquitto), les sondes ESP32/ESPHome et les ponts domotiques.
3. **Cliquer sur le bouton « Scanner le réseau »** :
   Une barre de progression en temps réel apparaît en haut de l'écran avec l'adresse IP couramment sondée. Les nouveaux équipements et services identifiés sont automatiquement ajoutés à la cartographie et notifiés dans le journal.

---

### 7.3 Cartographie interactive (Topologie Réseau)

L'onglet **« Topologie Réseau »** offre une représentation graphique complète :
- **Navigation fluide** :
  - **Déplacement (Pan)** : Cliquez et glissez sur le fond de toile pour déplacer la vue.
  - **Zoom** : Utilisez la molette de la souris ou les boutons `+` / `-` en bas à droite. Le bouton **Plein écran** réinitialise le zoom à 100%.
  - **Repositionnement des nœuds (Drag & Drop)** : Chaque boîte d'équipement peut être déplacée à la souris. Sa nouvelle position est immédiatement mémorisée.
- **Compréhension des liens visuels** :
  - **Lignes pleines bleues avec libellé** : Représentent les câbles Ethernet physiques reliés aux switches ou routeurs (ex: `Port 4 (1Gbps)`, `PoE 7.5W` ou `Wi-Fi 5GHz`).
  - **Lignes pointillées violettes / cyan avec flèches** : Représentent les liens de dépendance logique entre un serveur hôte physique et ses machines virtuelles (violet) ou ses conteneurs Docker (cyan).

---

### 7.4 Vue Hôtes & Dépendances de Virtualisation

L'onglet **« Hôtes & Dépendances »** permet de gérer facilement les infrastructures hybrides :
- Chaque serveur physique (Serveur Proxmox, hôte Docker, NAS) est présenté dans une carte récapitulative listant ses spécifications (CPU, RAM, OS, emplacement).
- À l'intérieur de la carte figurent :
  - La liste des **Machines Virtuelles (VM)** hébergées.
  - La liste des **Conteneurs Docker** hébergés.
- **Réassignation / Migration dynamique** :
  - Chaque VM ou conteneur dispose d'un menu déroulant permettant de le transférer immédiatement sur un autre hôte physique (ou de le détacher en équipement autonome).
- **Création rapide** :
  - Cliquez sur **« Ajouter VM »** ou **« Ajouter Conteneur »** sur une carte d'hôte pour créer un nouvel élément déjà pré-rattaché à ce serveur.

---

### 7.5 Personnalisation graphique et métadonnées d'un équipement

Sur n'importe quel équipement (sur le graphique, dans l'inventaire ou dans la vue dépendances) :
1. Cliquez sur l'icône **Crayon (Éditer)** pour ouvrir le panneau d'inspection.
2. **Image réaliste personnalisée** :
   - Renseignez une URL d'image de votre choix dans le champ *« URL d'image personnalisée »*.
   - Ou cliquez sur l'un des préréglages réalistes proposés (Serveur rack 2U Dell PowerEdge, Passerelle UniFi UDM Pro, Switch 24P, NAS 4 baies Synology, Conteneur Docker, Caméra IP 4K, Capteur radar mmWave, Sonde ESP32).
3. **Étiquettes contextuelles (Tags)** :
   - Ajoutez des tags comme `Production`, `DMZ`, `VLAN 20`, `Secours`, `Baie Brassage`.
4. **Métadonnées techniques personnalisées (Clé / Valeur)** :
   - Ajoutez des informations sur mesure : `vCPU`, `RAM`, `Consommation`, `Adresse MAC`, `Version Firmware`, `Flux RTSP`, etc.
5. **Test de connectivité direct (Ping)** :
   - Cliquez sur le bouton **« Tester Ping »** en haut de la fenêtre modale pour exécuter une mesure de latence (RTT) et vérifier les ports ouverts.

---

### 7.6 Inventaire détaillé et filtrage dynamique

L'onglet **« Inventaire Équipements »** présente une vue tabulaire dense :
- **Filtres de types** : Boutons d'accès direct pour n'afficher que les machines *Physiques*, les *VMs*, les conteneurs *Docker* ou les périphériques *IoT*.
- **Filtres d'état et VLAN** : Basculez entre les équipements *En ligne* et *Hors ligne*, ou filtrez par VLAN spécifique (VLAN 1, VLAN 10, VLAN 20).
- **Barre de recherche dynamique** : Filtre instantanément par adresse IP, nom, fabricant, OS, adresse MAC ou étiquette.
- **Actions rapides** : Boutons de test ping, modification et suppression pour chaque ligne.

---

### 7.7 Journalisation en temps réel (SSE)

L'onglet **« Journal Temps Réel »** affiche une console de télémétrie en direct :
- Chaque événement est horodaté à la milliseconde (`HH:mm:ss.sss`) et typé par niveau (`INFO`, `DISCOVERY`, `WARN`, `ALERT`) et catégorie (`ARP`, `PORT`, `DOCKER`, `VM`, `IOT`, `SYSTEM`).
- **Défilement automatique** : Peut être mis en pause via le bouton dédié pour inspecter un journal sans être dérangé par les nouvelles arrivées.
- **Filtres de recherche et de catégorie** : Permet d'isoler uniquement les alertes ou les découvertes Docker/IoT.
- **Copie rapide** : Cliquez sur l'icône de copie à côté d'une ligne pour copier l'événement formaté dans votre presse-papier.

---

### 7.8 Export de la configuration

Dans la barre d'outils, cliquez sur l'icône **Téléchargement (Export)** pour générer un fichier `inkanetopology-export.json`. Ce fichier contient l'intégralité de la topologie réseau, les coordonnées des nœuds, les liaisons de dépendance et l'historique des journaux.

---

## 8. Intégration Reverse Proxy (HTTPS)

Si vous souhaitez exposer InkaNetopology avec un certificat SSL Let's Encrypt, voici un exemple de configuration pour **Nginx** ou **Nginx Proxy Manager** :

```nginx
server {
    listen 80;
    server_name topology.mondomaine.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name topology.mondomaine.local;

    ssl_certificate /etc/letsencrypt/live/topology.mondomaine.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/topology.mondomaine.local/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Configuration indispensable pour le streaming en temps réel (Server-Sent Events)
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Note importante pour le streaming SSE** : La directive `proxy_buffering off;` est cruciale pour que les événements du journal en direct parviennent immédiatement au navigateur sans délai de tampon.

---

## 9. Dépannage & FAQ

### Q1. Pourquoi les équipements du réseau ne sont pas découverts lors d'un scan ?
- **Cause fréquente** : Le conteneur Docker a été lancé sans `network_mode: host`.
- **Solution** : Assurez-vous que la directive `network_mode: host` est bien présente dans votre `docker-compose.yml` (ou `--net=host` en CLI). Sans cela, les paquets ARP ne peuvent pas franchir la barrière NAT de Docker.
- Vérifiez également que le sous-réseau sélectionné dans l'interface correspond bien à votre plan d'adressage (ex: `192.168.1.0/24`).

### Q2. Erreur d'accès au socket Docker (`/var/run/docker.sock`)
- Si vous souhaitez que le scanner liste automatiquement les conteneurs Docker présents sur la machine hôte, le fichier `/var/run/docker.sock` doit être monté en volume.
- Si le conteneur indique une permission refusée, assurez-vous que l'utilisateur exécutant Docker possède les droits de lecture sur ce socket.

### Q3. Comment changer le port d'écoute ?
- En mode `network_mode: host`, le conteneur écoute directement sur le port configuré par la variable d'environnement `PORT`.
- Modifiez la variable `PORT=8080` dans votre `docker-compose.yml` pour utiliser le port 8080 au lieu du port 3000 par défaut.

---

## Licence

Distribué sous licence open-source Apache 2.0.
