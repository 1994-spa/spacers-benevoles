/**
 * accreditation-generator.js
 *
 * Module partagé de génération d'accréditations bénévoles Spacers.
 * Sans UI : expose 3 fonctions publiques utilisables depuis
 * dashboard.html (bénévole) et pilote.html (modération).
 *
 * Prérequis dans le HTML appelant :
 *   1. jsPDF chargé globalement :
 *      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   2. Polices Sansation + Heaters déclarées dans un @font-face
 *      (idéalement dans theme.css) et pré-chargées via
 *      `await document.fonts.ready` avant tout appel de rendu.
 *   3. Template PNG accessible à /img/accreditation/template-club-2627.png
 *   4. Verso PNG accessible à /img/accreditation/verso-plan-acces-2627.png
 *
 * API publique :
 *   - AccreditationGenerator.render(canvas, params) → Promise<void>
 *   - AccreditationGenerator.downloadPng(params)     → Promise<void>
 *   - AccreditationGenerator.downloadPdf(params)     → Promise<void>
 *
 * Exemple d'utilisation côté dashboard.html :
 *   await AccreditationGenerator.downloadPdf({
 *     prenom: 'Dylan',
 *     nom: 'Jollet',
 *     roleLibelle: 'CLUB',
 *     zonesAutorisees: [2, 3, 6],
 *     photoUrl: 'https://xxx.supabase.co/.../signed-url'
 *   });
 */
(function (global) {
  'use strict';

  // ============================================================
  // CONFIGURATION (calibrage fourni par l'utilisateur)
  // ============================================================
  const COORDS = {
    version: '2627',
    template_width: 1240,
    template_height: 1754,
    photo: { cx: 619, cy: 539, r: 163 },
    nom:   { x1: 300, y1: 784,  x2: 912, y2: 919  },
    role:  { x1: 293, y1: 1084, x2: 921, y2: 1145 },
    zones: {
      1: { label: 'Terrain',           color: '#8b5cf6', cx: 195,  cy: 1417, r: 73 },
      2: { label: 'Plateau',           color: '#22c55e', cx: 369,  cy: 1416, r: 73 },
      3: { label: 'Vestiaires',        color: '#1e3a8a', cx: 544,  cy: 1416, r: 73 },
      4: { label: 'Zone médias',       color: '#ef4444', cx: 722,  cy: 1417, r: 73 },
      5: { label: 'Salons VIP',        color: '#ffffff', cx: 897,  cy: 1419, r: 73 },
      6: { label: 'Espace bénévoles',  color: '#facc15', cx: 1071, cy: 1417, r: 73 }
    }
  };

  const CHARTE = {
    night:    '#001E2D',
    day:      '#91BEE6',
    dayLight: '#C8D2EB',
    white:    '#FFFFFF'
  };

  const ASSETS = {
    templatePath: '/img/accreditation/template-club-2627.png',
    versoPath:    '/img/accreditation/verso-plan-acces-2627.png'
  };

  // ============================================================
  // CACHE D'IMAGES (évite de recharger le template et le verso
  // à chaque rendu — le module peut être appelé plusieurs fois
  // dans un même chargement de page)
  // ============================================================
  const imageCache = {};

  function loadImage(src) {
    if (imageCache[src]) return Promise.resolve(imageCache[src]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // pour les URLs signées Supabase
      img.onload = () => {
        imageCache[src] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('Impossible de charger : ' + src));
      img.src = src;
    });
  }

  // ============================================================
  // HELPERS DE RENDU DE TEXTE
  // ============================================================

  /**
   * Trouve la plus grande taille de police telle que le texte
   * tienne dans (maxWidth, maxHeight).
   */
  function fitTextSize(ctx, text, fontFamily, maxWidth, maxHeight, maxSize, minSize) {
    minSize = minSize || 20;
    for (let size = maxSize; size >= minSize; size -= 2) {
      ctx.font = 'bold ' + size + 'px "' + fontFamily + '"';
      const metrics = ctx.measureText(text);
      if (metrics.width <= maxWidth && size <= maxHeight) return size;
    }
    return minSize;
  }

  /**
   * Dessine prénom + nom sur 2 lignes, taille auto-ajustée,
   * centrées dans le rectangle.
   */
  function drawNomInRect(ctx, prenom, nom, rect) {
    const w  = rect.x2 - rect.x1;
    const h  = rect.y2 - rect.y1;
    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;

    // 2 lignes + 15% d'interligne doivent tenir dans h
    const maxSize = Math.min(h * 0.42, 100);

    const size1 = fitTextSize(ctx, prenom, 'Sansation', w * 0.92, maxSize, maxSize);
    const size2 = fitTextSize(ctx, nom,    'Sansation', w * 0.92, maxSize, maxSize);
    const finalSize = Math.min(size1, size2);

    ctx.fillStyle    = CHARTE.night;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold ' + finalSize + 'px "Sansation"';

    const gap = finalSize * 0.15;
    const y1  = cy - (finalSize + gap) / 2;
    const y2  = cy + (finalSize + gap) / 2;

    ctx.fillText(prenom, cx, y1);
    ctx.fillText(nom,    cx, y2);
  }

  /**
   * Dessine le rôle (CLUB, ARBITRES, etc.) en Heaters,
   * majuscules, une ligne centrée.
   */
  function drawRoleInRect(ctx, role, rect) {
    const w  = rect.x2 - rect.x1;
    const h  = rect.y2 - rect.y1;
    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;

    const maxSize = Math.min(h * 1.4, 110);
    const size = fitTextSize(ctx, role, 'Heaters', w * 0.85, h * 1.4, maxSize);

    ctx.fillStyle    = CHARTE.night;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = size + 'px "Heaters"';
    ctx.fillText(role, cx, cy);
  }

  /**
   * Dessine la photo du bénévole en cercle (mode cover).
   */
  function drawPhotoInCircle(ctx, img, spec) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(spec.cx, spec.cy, spec.r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const scale = Math.max((spec.r * 2) / img.width, (spec.r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, spec.cx - w / 2, spec.cy - h / 2, w, h);
    ctx.restore();
  }

  /**
   * Applique le traitement niveau 3 sur les pastilles :
   * - Autorisée : halo bleu DAY + anneau blanc
   * - Refusée : occultation + silhouette pâle + chiffre pâle
   */
  function drawZones(ctx, zonesAutorisees) {
    const autoriseesSet = new Set(zonesAutorisees.map(String));

    Object.keys(COORDS.zones).forEach((id) => {
      const z = COORDS.zones[id];
      const isAutorisee = autoriseesSet.has(String(id));

      if (isAutorisee) {
        // Halo bleu DAY
        ctx.save();
        const gradient = ctx.createRadialGradient(z.cx, z.cy, z.r, z.cx, z.cy, z.r * 1.7);
        gradient.addColorStop(0,   'rgba(145, 190, 230, 0.6)');
        gradient.addColorStop(0.5, 'rgba(145, 190, 230, 0.25)');
        gradient.addColorStop(1,   'rgba(145, 190, 230, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Anneau blanc
        ctx.save();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Occultation avec la couleur du fond
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = CHARTE.night;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Silhouette pâle de la pastille
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Chiffre pâle
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold ' + (z.r * 0.9) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(id, z.cx, z.cy);
        ctx.restore();
      }
    });
  }

  // ============================================================
  // API PUBLIQUE
  // ============================================================

  /**
   * Rendu principal : dessine l'accréditation sur un canvas fourni.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} params
   * @param {string} params.prenom
   * @param {string} params.nom
   * @param {string} params.roleLibelle   Ex: "CLUB", "ARBITRES"
   * @param {Array<number>} params.zonesAutorisees Ex: [2, 3, 6]
   * @param {string} params.photoUrl      URL de la photo (signed URL Supabase)
   * @param {string} [params.templatePath] Override du chemin template si besoin
   * @returns {Promise<void>}
   */
  async function render(canvas, params) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('render() : canvas invalide');
    }
    const ctx = canvas.getContext('2d');
    canvas.width  = COORDS.template_width;
    canvas.height = COORDS.template_height;

    // Chargement des assets en parallèle
    const templatePath = params.templatePath || ASSETS.templatePath;
    const [templateImg, photoImg] = await Promise.all([
      loadImage(templatePath),
      loadImage(params.photoUrl)
    ]);

    // 1. Template en fond
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

    // 2. Photo circulaire
    drawPhotoInCircle(ctx, photoImg, COORDS.photo);

    // 3. Nom (prénom + nom en majuscules)
    const prenomUpper = (params.prenom || '').toUpperCase();
    const nomUpper    = (params.nom || '').toUpperCase();
    drawNomInRect(ctx, prenomUpper, nomUpper, COORDS.nom);

    // 4. Rôle
    const roleUpper = (params.roleLibelle || 'CLUB').toUpperCase();
    drawRoleInRect(ctx, roleUpper, COORDS.role);

    // 5. Zones
    drawZones(ctx, params.zonesAutorisees || []);
  }

  /**
   * Génère l'accréditation et déclenche le téléchargement en PNG (recto seul).
   */
  async function downloadPng(params) {
    const canvas = document.createElement('canvas');
    await render(canvas, params);
    const filename = buildFileName(params, 'png');
    canvas.toBlob((blob) => {
      triggerDownload(blob, filename);
    }, 'image/png');
  }

  /**
   * Génère l'accréditation en PDF 2 pages A4 (recto perso + verso commun).
   */
  async function downloadPdf(params) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('jsPDF non chargé. Ajoutez <script src="jspdf.umd.min.js"> dans le HTML.');
    }
    const canvas = document.createElement('canvas');
    await render(canvas, params);

    const versoImg = await loadImage(ASSETS.versoPath);

    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Page 1 : recto
    const rectoData = canvas.toDataURL('image/png');
    const r = fitImageToA4(canvas.width, canvas.height);
    pdf.addImage(rectoData, 'PNG', r.x, r.y, r.w, r.h);

    // Page 2 : verso
    const vCanvas = document.createElement('canvas');
    vCanvas.width  = versoImg.naturalWidth;
    vCanvas.height = versoImg.naturalHeight;
    vCanvas.getContext('2d').drawImage(versoImg, 0, 0);
    const versoData = vCanvas.toDataURL('image/png');
    const v = fitImageToA4(versoImg.naturalWidth, versoImg.naturalHeight);
    pdf.addPage();
    pdf.addImage(versoData, 'PNG', v.x, v.y, v.w, v.h);

    pdf.save(buildFileName(params, 'pdf'));
  }

  // ============================================================
  // HELPERS INTERNES
  // ============================================================

  function fitImageToA4(imgW, imgH) {
    const pdfW = 210, pdfH = 297;
    const canvasRatio = imgW / imgH;
    const pdfRatio    = pdfW / pdfH;
    let w, h;
    if (canvasRatio > pdfRatio) { w = pdfW; h = pdfW / canvasRatio; }
    else                        { h = pdfH; w = pdfH * canvasRatio; }
    return { x: (pdfW - w) / 2, y: (pdfH - h) / 2, w: w, h: h };
  }

  function buildFileName(params, ext) {
    const p = (params.prenom || 'accred').replace(/[^A-Z0-9]/gi, '_');
    const n = (params.nom || '').replace(/[^A-Z0-9]/gi, '_');
    return 'accred_' + p + '_' + n + '_2627.' + ext;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ============================================================
  // EXPORT
  // ============================================================
  global.AccreditationGenerator = {
    render: render,
    downloadPng: downloadPng,
    downloadPdf: downloadPdf,
    // Exposé pour debug / test
    _COORDS: COORDS,
    _CHARTE: CHARTE,
    _ASSETS: ASSETS
  };

})(window);
