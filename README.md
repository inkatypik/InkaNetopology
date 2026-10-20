# InkaNetopology - Scanner Réseau Local & Cartographie Interactive

[![Docker Publish (GHCR)](https://github.com/inkatypik/InkaNetopology/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/inkatypik/InkaNetopology/actions/workflows/docker-publish.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Image](https://img.shields.io/badge/Docker_Image-GHCR-cyan.svg)](https://github.com/inkatypik/InkaNetopology/pkgs/container/inkanetopology)

**InkaNetopology** est une application web conteneurisée sous Docker conçue pour scanner le réseau local (LAN), identifier automatiquement les équipements connectés, modéliser avec précision leurs relations physiques et de virtualisation (machines physiques, machines virtuelles, conteneurs Docker, objets connectés IoT), et fournir une journalisation en temps réel dans une interface soignée avec mode sombre.

- **Dépôt GitHub** : [https://github.com/inkatypik/InkaNetopology](https://github.com/inkatypik/InkaNetopology)
- **Image officielle (GHCR)** : `ghcr.io/inkatypik/inkanetopology:latest`

---

## Sommaire

1. [Démarrage Express en 1 Minute (via GitHub & GHCR)](#1-démarrage-express-en-1-minute-via-github--ghcr)
2. [Fonctionnalités Clés](#2-fonctionnalités-clés)
3. [Architecture Technique & CI/CD](#3-architecture-technique--cicd)
4. [Fichier Docker Compose](#4-fichier-docker-compose)
5. [Méthodes de Déploiement](#5-méthodes-de-déploiement)
   - [Méthode 1 : Déploiement sans clonage (Recommandé)](#méthode-1--déploiement-sans-clonage-recommandé)
   - [Méthode 2 : Déploiement en clonant le dépôt GitHub](#méthode-2--déploiement-en-clonant-le-dépôt-github)
   - [Méthode 3 : Lancement direct en ligne de commande (Docker CLI)](#méthode-3--lancement-direct-en-ligne-de-commande-docker-cli)
6. [Guide d'Utilisation](#6-guide-dutilisation)
   - [6.1 Accès à l'interface](#61-accès-à-linterface)
   - [6.2 Lancer un scan réseau](#62-lancer-un-scan-réseau)
   - [6.3 Cartographie interactive (Topologie Réseau)](#63-cartographie-interactive-topologie-réseau)
   - [6.4 Vue Hôtes & Dépendances de Virtualisation](#64-vue-hôtes--dépendances-de-virtualisation)
   - [6.5 Personnalisation graphique et métadonnées d'un équipement](#65-personnalisation-graphique-et-métadonnées-dun-équipement)
   - [6.6 Inventaire détaillé et filtrage dynamique](#66-inventaire-détaillé-et-filtrage-dynamique)
   - [6.7 Journalisation en temps réel (SSE)](#67-journalisation-en-temps-réel-sse)
   - [6.8 Export de la configuration](#68-export-de-la-configuration)
7. [Intégration Reverse Proxy (HTTPS & Nginx)](#7-intégration-reverse-proxy-https--nginx)
8. [Dépannage & FAQ](#8-dépannage--faq)

---

## 1. Démarrage Express en 1 Minute (via GitHub & GHCR)

Vous n'avez même pas besoin d'installer Node.js ou de cloner tout le dépôt sur votre serveur :

```bash
mkdir -p /opt/inkanetopology && cd /opt/inkanetopology
curl -sSL https://raw.githubusercontent.com/inkatypik/InkaNetopology/main/docker-compose.yml -o docker-compose.yml
docker compose pull
docker compose up -d
```

Ouvrez ensuite votre navigateur sur `http://<IP-DU-SERVEUR>:3000`.

---

## 2. Fonctionnalités Clés

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

## 3. Architecture Technique & CI/CD

- **Frontend** : React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas SVG dynamique.
- **Backend** : Node.js, Express, Server-Sent Events (SSE) pour le flux live, inspection des interfaces réseau locales via l'API `os` et `/proc/net/arp`.
- **Registre de Conteneurs GitHub (GHCR)** :
  - Image officielle : `ghcr.io/inkatypik/inkanetopology:latest`
  - Multi-architecture : `linux/amd64` (serveurs x86) et `linux/arm64` (Raspberry Pi 4/5, NAS ARM).
- **Intégration Continue (GitHub Actions)** :
  - Le fichier `.github/workflows/docker-publish.yml` compile automatiquement l'image Docker multi-plateformes et la publie sur GHCR à chaque commit sur `main` ou création de tag de version.

---

## 4. Fichier Docker Compose

Voici le fichier `docker-compose.yml` complet et optimisé :

```yaml
services:
  inkanetopology:
    # Image officielle pré-construite hébergée sur GitHub Container Registry (GHCR)
    image: ghcr.io/inkatypik/inkanetopology:latest
    # Build local optionnel lors d'une compilation depuis les sources
    build:
      context: .
      dockerfile: Dockerfile
    container_name: inkanetopology-scanner
    restart: unless-stopped

    # CRITIQUE: Le mode 'host' permet au conteneur de partager directement
    # les interfaces réseau physiques de la machine hôte pour émettre
    # des requêtes ARP broadcast sur le LAN et écouter les paquets mDNS/SSDP.
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

---

## 5. Méthodes de Déploiement

### Méthode 1 : Déploiement sans clonage (Recommandé)

1. **Créer le répertoire de travail** :
   ```bash
   mkdir -p /opt/inkanetopology && cd /opt/inkanetopology
   ```

2. **Télécharger le `docker-compose.yml` officiel depuis GitHub** :
   ```bash
   curl -sSL https://raw.githubusercontent.com/inkatypik/InkaNetopology/main/docker-compose.yml -o docker-compose.yml
   ```

3. **Démarrer avec Docker Compose** :
   ```bash
   docker compose pull
   docker compose up -d
   ```

---

### Méthode 2 : Déploiement en clonant le dépôt GitHub

Pour les utilisateurs qui souhaitent cloner le code source ou apporter des modifications :

```bash
# 1. Cloner le dépôt GitHub
git clone https://github.com/inkatypik/InkaNetopology.git /opt/inkanetopology
cd /opt/inkanetopology

# 2. Lancer directement avec l'image GHCR pré-construite
docker compose up -d

# 3. (Optionnel) Ou recompiler localement depuis les sources
docker compose up -d --build
```

---

### Méthode 3 : Lancement direct en ligne de commande (Docker CLI)

Sans fichier Compose, vous pouvez lancer l'image GHCR en une seule commande :

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
  ghcr.io/inkatypik/inkanetopology:latest
```

---

## 6. Guide d'Utilisation

### 6.1 Accès à l'interface

Une fois le conteneur démarré, ouvrez votre navigateur web et accédez à :
```text
http://<ADRESSE_IP_DU_SERVEUR>:3000
```
*(Par exemple : `http://192.168.1.10:3000`)*.

---

### 6.2 Lancer un scan réseau

1. **Vérifier le sous-réseau** :
   Dans la barre d'outils supérieure, le champ **Sous-réseau** affiche automatiquement le masque détecté sur votre machine hôte (ex: `192.168.1.0/24`). Vous pouvez le modifier si vous souhaitez scanner un autre VLAN ou segment réseau (ex: `192.168.20.0/24`).
2. **Choisir le mode de scan** :
   - **Découverte Rapide (ARP/ICMP)** : Balayage express pour repérer les machines allumées et récupérer leurs adresses MAC.
   - **Scan Approfondi (Ports & OS)** : Interroge les ports d'administration courants (SSH, HTTP, HTTPS, Proxmox, NAS, etc.) pour déterminer l'OS et les services.
   - **Audit Spécialisé IoT & Domotique** : Recherche ciblée sur les flux RTSP (caméras de surveillance), les brokers MQTT (Mosquitto), les sondes ESP32/ESPHome et les ponts domotiques.
3. **Cliquer sur le bouton « Scanner le réseau »** :
   Une barre de progression en temps réel apparaît en haut de l'écran avec l'adresse IP couramment sondée. Les nouveaux équipements et services identifiés sont automatiquement ajoutés à la cartographie et notifiés dans le journal.

---

### 6.3 Cartographie interactive (Topologie Réseau)

L'onglet **« Topologie Réseau »** offre une représentation graphique complète :
- **Navigation fluide** :
  - **Déplacement (Pan)** : Cliquez et glissez sur le fond de toile pour déplacer la vue.
  - **Zoom** : Utilisez la molette de la souris ou les boutons `+` / `-` en bas à droite. Le bouton **Plein écran** réinitialise le zoom à 100%.
  - **Repositionnement des nœuds (Drag & Drop)** : Chaque boîte d'équipement peut être déplacée à la souris. Sa nouvelle position est immédiatement mémorisée.
- **Compréhension des liens visuels** :
  - **Lignes pleines bleues avec libellé** : Représentent les câbles Ethernet physiques reliés aux switches ou routeurs (ex: `Port 4 (1Gbps)`, `PoE 7.5W` ou `Wi-Fi 5GHz`).
  - **Lignes pointillées violettes / cyan avec flèches** : Représentent les liens de dépendance logique entre un serveur hôte physique et ses machines virtuelles (violet) ou ses conteneurs Docker (cyan).

---

### 6.4 Vue Hôtes & Dépendances de Virtualisation

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

### 6.5 Personnalisation graphique et métadonnées d'un équipement

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

### 6.6 Inventaire détaillé et filtrage dynamique

L'onglet **« Inventaire Équipements »** présente une vue tabulaire dense :
- **Filtres de types** : Boutons d'accès direct pour n'afficher que les machines *Physiques*, les *VMs*, les conteneurs *Docker* ou les périphériques *IoT*.
- **Filtres d'état et VLAN** : Basculez entre les équipements *En ligne* et *Hors ligne*, ou filtrez par VLAN spécifique (VLAN 1, VLAN 10, VLAN 20).
- **Barre de recherche dynamique** : Filtre instantanément par adresse IP, nom, fabricant, OS, adresse MAC ou étiquette.
- **Actions rapides** : Boutons de test ping, modification et suppression pour chaque ligne.

---

### 6.7 Journalisation en temps réel (SSE)

L'onglet **« Journal Temps Réel »** affiche une console de télémétrie en direct :
- Chaque événement est horodaté à la milliseconde (`HH:mm:ss.sss`) et typé par niveau (`INFO`, `DISCOVERY`, `WARN`, `ALERT`) et catégorie (`ARP`, `PORT`, `DOCKER`, `VM`, `IOT`, `SYSTEM`).
- **Défilement automatique** : Peut être mis en pause via le bouton dédié pour inspecter un journal sans être dérangé par les nouvelles arrivées.
- **Filtres de recherche et de catégorie** : Permet d'isoler uniquement les alertes ou les découvertes Docker/IoT.
- **Copie rapide** : Cliquez sur l'icône de copie à côté d'une ligne pour copier l'événement formaté dans votre presse-papier.

---

### 6.8 Export de la configuration

Dans la barre d'outils, cliquez sur l'icône **Téléchargement (Export)** pour générer un fichier `inkanetopology-export.json`. Ce fichier contient l'intégralité de la topologie réseau, les coordonnées des nœuds, les liaisons de dépendance et l'historique des journaux.

---

## 7. Intégration Reverse Proxy (HTTPS & Nginx)

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

## 8. Dépannage & FAQ

### Q1. Pourquoi les équipements du réseau ne sont pas découverts lors d'un scan ?
- **Cause fréquente** : Le conteneur Docker a été lancé sans `network_mode: host`.
- **Solution** : Assurez-vous que la directive `network_mode: host` est bien présente dans votre `docker-compose.yml` (ou `--net=host` en CLI). Sans cela, les paquets ARP ne peuvent pas franchir la barrière NAT de Docker.
- Vérifiez également que le sous-réseau sélectionné dans l'interface correspond bien à votre plan d'adressage (ex: `192.168.1.0/24`).

### Q2. Comment mettre à jour vers la dernière version publiée sur GitHub ?
Exécutez simplement :
```bash
docker compose pull
docker compose up -d
```

### Q3. Comment changer le port d'écoute ?
En mode `network_mode: host`, le conteneur écoute directement sur le port configuré par la variable d'environnement `PORT`.
Modifiez la variable `PORT=8080` dans votre `docker-compose.yml` pour utiliser le port 8080 au lieu du port 3000 par défaut.

---

## Licence

Distribué sous licence open-source Apache 2.0.
