import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Terminal,
  Container,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Network,
  Layers,
  HelpCircle,
  FileCode2
} from 'lucide-react';

interface DockerDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DockerDeployModal: React.FC<DockerDeployModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeDocTab, setActiveDocTab] = useState<'docker' | 'guide' | 'proxy' | 'faq'>('docker');
  const [copiedCompose, setCopiedCompose] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedNginx, setCopiedNginx] = useState(false);

  const composeCode = `services:
  inkanetopology:
    # Image GitHub Container Registry (GHCR)
    image: ghcr.io/inkatypik/inkanetopology:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: inkanetopology-scanner
    restart: unless-stopped

    # CRITIQUE: Le mode 'host' permet au conteneur de partager directement
    # les interfaces réseau physiques de l'hôte pour envoyer des requêtes
    # ARP broadcast sur le LAN et écouter les paquets mDNS/SSDP des objets IoT.
    network_mode: host

    # Capacités Linux indispensables pour forger des trames ICMP/ARP
    cap_add:
      - NET_ADMIN
      - NET_RAW

    environment:
      - NODE_ENV=production
      - PORT=3000

    volumes:
      # Persistance de l'inventaire et des équipements découverts
      - ./data:/app/data
      # Montage optionnel du socket Docker pour l'identification native des conteneurs locaux
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

  const cliCode = `docker run -d \\
  --name inkanetopology-scanner \\
  --restart unless-stopped \\
  --net=host \\
  --cap-add=NET_ADMIN \\
  --cap-add=NET_RAW \\
  -v $(pwd)/data:/app/data \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e PORT=3000 \\
  -e NODE_ENV=production \\
  ghcr.io/inkatypik/inkanetopology:latest`;

  const nginxCode = `server {
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

        # Indispensable pour le streaming en temps réel (Server-Sent Events)
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
}`;

  const copyToClipboard = (text: string, type: 'compose' | 'cli' | 'nginx') => {
    navigator.clipboard.writeText(text);
    if (type === 'compose') {
      setCopiedCompose(true);
      setTimeout(() => setCopiedCompose(false), 2000);
    } else if (type === 'cli') {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } else {
      setCopiedNginx(true);
      setTimeout(() => setCopiedNginx(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Documentation & Guide de Déploiement InkaNetopology
              </h3>
              <p className="text-xs text-slate-400">
                Installation Docker Compose, guide d'utilisation pas à pas et configuration réseau.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/30 text-xs">
          <button
            onClick={() => setActiveDocTab('docker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDocTab === 'docker'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Container className="w-3.5 h-3.5" />
            <span>Déploiement Docker</span>
          </button>

          <button
            onClick={() => setActiveDocTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDocTab === 'guide'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Guide d'Utilisation</span>
          </button>

          <button
            onClick={() => setActiveDocTab('proxy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDocTab === 'proxy'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Reverse Proxy & HTTPS</span>
          </button>

          <button
            onClick={() => setActiveDocTab('faq')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDocTab === 'faq'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Dépannage & FAQ</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs flex-1">
          {/* TAB 1: DOCKER DEPLOYMENT */}
          {activeDocTab === 'docker' && (
            <div className="space-y-5">
              {/* Why Host Network is essential */}
              <div className="p-4 bg-cyan-950/30 border border-cyan-800/50 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Pourquoi le mode hôte (`network_mode: host`) est requis ?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Par défaut, Docker place les conteneurs dans un réseau privé virtuel isolé par NAT (ex: <code className="font-mono text-cyan-300">172.17.0.0/16</code>). Dans ce mode isolé, le conteneur ne peut pas envoyer de requêtes <strong>ARP broadcast</strong> à votre routeur et vos équipements physiques locaux, ni écouter les annonces <strong>mDNS/SSDP</strong> des caméras et capteurs domotiques. Le paramètre <code className="font-mono text-cyan-300">network_mode: host</code> permet au scanner d'accéder directement à vos cartes réseau physiques Ethernet et Wi-Fi.
                </p>
              </div>

              {/* Docker Compose snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-cyan-400" />
                    <span>Fichier docker-compose.yml recommandé</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(composeCode, 'compose')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md font-mono text-[11px] transition-colors"
                  >
                    {copiedCompose ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier docker-compose.yml</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto font-mono text-[11px] text-slate-300 leading-relaxed">
                  {composeCode}
                </pre>
              </div>

              {/* Docker CLI run command */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Alternative en ligne de commande (Docker CLI)</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(cliCode, 'cli')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md font-mono text-[11px] transition-colors"
                  >
                    {copiedCli ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier commande</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto font-mono text-[11px] text-slate-300 leading-relaxed">
                  {cliCode}
                </pre>
              </div>

              {/* Key Features Table */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="font-semibold text-cyan-300 block mb-1">Capacités Linux</span>
                  <span className="text-slate-400 text-[11px]">
                    <code className="text-slate-300 font-mono">NET_ADMIN</code> et <code className="text-slate-300 font-mono">NET_RAW</code> permettent d'ouvrir des raw sockets pour le ping ICMP et les paquets ARP sans être root.
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="font-semibold text-cyan-300 block mb-1">Table ARP Native</span>
                  <span className="text-slate-400 text-[11px]">
                    Grâce à <code className="text-slate-300 font-mono">network_mode: host</code>, le conteneur accède nativement à la table ARP et aux interfaces réseau réelles du noyau Linux sans montage complexe.
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="font-semibold text-cyan-300 block mb-1">Socket Docker Local</span>
                  <span className="text-slate-400 text-[11px]">
                    Le montage de <code className="text-slate-300 font-mono">/var/run/docker.sock</code> permet d'énumérer les conteneurs locaux et de les relier dynamiquement à l'hôte physique.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER GUIDE */}
          {activeDocTab === 'guide' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-mono">1</span>
                  <span>Lancer un scan réseau</span>
                </h4>
                <p className="text-slate-300 leading-relaxed pl-8">
                  Dans la barre d'outils supérieure, renseignez le sous-réseau souhaité (ex: <code className="font-mono text-cyan-300">192.168.1.0/24</code>) et choisissez votre mode de scan :
                </p>
                <ul className="list-disc pl-12 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Découverte Rapide (ARP/ICMP)</strong> : Balayage immédiat des adresses IP actives et récupération des adresses MAC.</li>
                  <li><strong className="text-slate-200">Scan Approfondi (Ports & OS)</strong> : Analyse des ports ouverts (80, 443, 22, 8006, 5000) pour déterminer le rôle de la machine et le système d'exploitation.</li>
                  <li><strong className="text-slate-200">Audit Spécialisé IoT</strong> : Recherche ciblée sur les flux RTSP (caméras IP), les brokers MQTT (Mosquitto) et les capteurs domotiques (ESP32, Zigbee/Matter).</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-mono">2</span>
                  <span>Naviguer et manipuler la cartographie interactive</span>
                </h4>
                <div className="text-slate-300 leading-relaxed pl-8 space-y-2">
                  <p>
                    L'onglet <strong>« Topologie Réseau »</strong> affiche la topologie complète sous forme de graphe dynamique :
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li><strong>Déplacement & Zoom</strong> : Cliquez et glissez sur l'arrière-plan pour déplacer la vue. Utilisez la molette ou les commandes en bas à droite pour zoomer.</li>
                    <li><strong>Glisser-Déposer (Drag & Drop)</strong> : Cliquez sur n'importe quel équipement pour le déplacer où vous voulez. Les coordonnées sont enregistrées automatiquement.</li>
                    <li><strong>Liaisons physiques vs virtuelles</strong> : Les traits continus bleus représentent les câbles réseau avec port/débit ; les lignes courbes pointillées relient chaque machine virtuelle ou conteneur Docker à son hôte physique.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-mono">3</span>
                  <span>Gérer les dépendances de virtualisation (Hôtes & Dépendances)</span>
                </h4>
                <p className="text-slate-300 leading-relaxed pl-8">
                  L'onglet <strong>« Hôtes & Dépendances »</strong> regroupe vos serveurs physiques (serveurs Proxmox, serveurs Docker, NAS). Chaque carte liste les machines virtuelles et conteneurs qui y sont exécutés. Un menu déroulant direct sur chaque VM ou conteneur permet de le transférer immédiatement sur un autre hôte ou de le détacher en équipement autonome.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-mono">4</span>
                  <span>Personnaliser les images, étiquettes et métadonnées</span>
                </h4>
                <p className="text-slate-300 leading-relaxed pl-8">
                  Cliquez sur l'icône <strong>Crayon (Éditer)</strong> sur un équipement pour ouvrir l'inspecteur. Vous pouvez y définir une <strong>image personnalisée</strong> (URL ou préréglage de matériel réaliste), gérer les <strong>étiquettes (Tags)</strong> et ajouter des <strong>métadonnées techniques clé-valeur</strong> (vCPU, RAM, consommation en watts, flux RTSP).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: REVERSE PROXY & HTTPS */}
          {activeDocTab === 'proxy' && (
            <div className="space-y-5">
              <p className="text-slate-300 leading-relaxed">
                Pour sécuriser l'accès à NetTopology avec un nom de domaine et un certificat SSL/TLS valide (Let's Encrypt), configurez un reverse proxy comme <strong>Nginx</strong> ou <strong>Nginx Proxy Manager</strong> :
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-cyan-400" />
                    <span>Configuration Nginx avec support SSE</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(nginxCode, 'nginx')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md font-mono text-[11px] transition-colors"
                  >
                    {copiedNginx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier bloc Nginx</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto font-mono text-[11px] text-slate-300 leading-relaxed">
                  {nginxCode}
                </pre>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-200">
                <strong>Attention au buffering SSE :</strong> La directive <code className="font-mono bg-slate-900 px-1 py-0.5 rounded">proxy_buffering off;</code> est obligatoire pour éviter que le proxy Nginx ne bloque les paquets de journalisation en temps réel émis par le flux Server-Sent Events.
              </div>
            </div>
          )}

          {/* TAB 4: FAQ */}
          {activeDocTab === 'faq' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-semibold text-slate-200 block text-xs">
                  Le scan ne trouve aucun équipement sur mon réseau local. Pourquoi ?
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  C'est le symptôme typique d'un conteneur lancé sans <code className="font-mono text-cyan-300">network_mode: host</code>. Vérifiez votre commande ou compose : sans le mode host, les broadcasts ARP restent confinés dans le bridge privé Docker.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-semibold text-slate-200 block text-xs">
                  Comment changer le port d'écoute 3000 ?
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  En mode host, modifiez simplement la variable d'environnement <code className="font-mono text-cyan-300">- PORT=8080</code> dans votre <code className="font-mono">docker-compose.yml</code>.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-semibold text-slate-200 block text-xs">
                  Comment sauvegarder ou exporter ma cartographie ?
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Utilisez le bouton de téléchargement dans la barre d'outils. Un fichier JSON contenant l'inventaire complet des nœuds, leurs coordonnées, métadonnées, liaisons de dépendance et logs d'événements sera généré.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-mono text-[11px]">
              InkaNetopology v1.0 · Conteneur Linux Node 22
            </span>
            <a
              href="/documentation.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-md font-medium text-[11px] transition-colors"
            >
              <span>Ouvrir la page documentation (HTML / PDF) ↗</span>
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
