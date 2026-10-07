/**
 * accreditation-generator.js — v4
 *
 * Changement v4 :
 *   - Chargement EXPLICITE des polices via l'API FontFace avant tout rendu
 *     (avant : le canvas dessinait avant que le navigateur ait charge
 *     Sansation/Heaters -> police de secours Arial/serif)
 *       * Sansation Bold -> prenom + nom
 *       * Heaters        -> libelle du role (BENEVOLE, etc.)
 *   - fitTextSize mesure avec la bonne graisse (Heaters n'existe qu'en 400)
 *   - Nouveau : renderToPngBlob(params) pour le batch ZIP PNG cote pilote
 *
 * Changement v5 :
 *   - QR code de pointage (params.qrToken) en haut a droite, contenu "SPB:<token>"
 *     (necessite la lib qrcode-generator ; sans lib ou sans token : pas de QR)
 *
 * Changement v3 :
 *   - SUPPRESSION du fill de couleur par-dessus la pastille
 *     (qui masquait les chiffres blancs du template)
 *   - COMPENSATION par un halo externe TRES INTENSE au bord
 *     de la pastille (opacity 0.95 au raz de la pastille)
 *   - Anneau blanc epais conserve (10px)
 *   - Zone 5 (blanche) : anneau bleu foncé, halo plus léger
 *
 * API publique inchangée :
 *   - AccreditationGenerator.render(canvas, params)
 *   - AccreditationGenerator.downloadPng(params)
 *   - AccreditationGenerator.downloadPdf(params)
 *   - AccreditationGenerator.renderToPdfBlob(params)
 */
(function (global) {
  'use strict';

  const COORDS = {
    version: '2627',
    template_width: 1240,
    template_height: 1754,
    photo: { cx: 619, cy: 539, r: 172 },
    nom:   { x1: 280, y1: 760,  x2: 960, y2: 960  },
    role:  { x1: 260, y1: 1050, x2: 980, y2: 1180 },
    qr:    { x: 1050, y: 14, size: 176 },
    zones: {
      1: { label: 'Terrain', color: '#8b5cf6', cx: 195,  cy: 1417, r: 73 },
      2: { label: 'Plateau / Zone mixte et m\u00e9dias', color: '#22c55e', cx: 369,  cy: 1416, r: 73 },
      3: { label: 'Espace logistique / Vestiaires', color: '#1e3a8a', cx: 544,  cy: 1416, r: 73 },
      4: { label: 'Tribune officielle', color: '#ef4444', cx: 722,  cy: 1417, r: 73 },
      5: { label: 'Salon partenaires', color: '#ffffff', cx: 897,  cy: 1419, r: 73 },
      6: { label: 'Espace b\u00e9n\u00e9vole et salon club', color: '#facc15', cx: 1071, cy: 1417, r: 73 }
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

  const FONTS = [
    { family: 'Sansation', url: '/fonts/Sansation_Bold.ttf', descriptors: { weight: '700', style: 'normal' } },
    { family: 'Heaters',   url: '/fonts/Heaters.otf',        descriptors: { weight: '400', style: 'normal' } }
  ];

  let fontsPromise = null;

  // Charge et enregistre les polices une seule fois (memoise).
  // Si une police echoue, on n'empeche pas le rendu mais on le signale.
  function ensureFonts() {
    if (fontsPromise) return fontsPromise;
    if (!global.FontFace || !document.fonts) {
      fontsPromise = Promise.resolve();
      return fontsPromise;
    }
    fontsPromise = Promise.all(FONTS.map(function (f) {
      const face = new FontFace(f.family, 'url("' + f.url + '")', f.descriptors);
      return face.load().then(function (loaded) {
        document.fonts.add(loaded);
        return true;
      }).catch(function (err) {
        console.warn('[accred] police non chargee : ' + f.family, err);
        return false;
      });
    })).then(function (res) {
      if (res.indexOf(false) !== -1) fontsPromise = null; // on retentera au prochain rendu
    });
    return fontsPromise;
  }

  const imageCache = {};

  function loadImage(src) {
    if (imageCache[src]) return Promise.resolve(imageCache[src]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imageCache[src] = img; resolve(img); };
      img.onerror = () => reject(new Error('Impossible de charger : ' + src));
      img.src = src;
    });
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  function fitTextSize(ctx, text, fontFamily, maxWidth, maxHeight, maxSize, minSize, weight) {
    minSize = minSize || 20;
    const w = weight || 'bold';
    for (let size = maxSize; size >= minSize; size -= 2) {
      ctx.font = w + ' ' + size + 'px "' + fontFamily + '"';
      const metrics = ctx.measureText(text);
      if (metrics.width <= maxWidth && size <= maxHeight) return size;
    }
    return minSize;
  }

  function drawNomInRect(ctx, prenom, nom, rect) {
    const w = rect.x2 - rect.x1, h = rect.y2 - rect.y1;
    const cx = (rect.x1 + rect.x2) / 2, cy = (rect.y1 + rect.y2) / 2;
    const maxSize = Math.min(h * 0.46, 110);
    const size1 = fitTextSize(ctx, prenom, 'Sansation', w * 0.92, maxSize, maxSize);
    const size2 = fitTextSize(ctx, nom, 'Sansation', w * 0.92, maxSize, maxSize);
    const finalSize = Math.min(size1, size2);
    ctx.fillStyle = CHARTE.night;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + finalSize + 'px "Sansation"';
    const gap = finalSize * 0.15;
    ctx.fillText(prenom, cx, cy - (finalSize + gap) / 2);
    ctx.fillText(nom, cx, cy + (finalSize + gap) / 2);
  }

  function drawRoleInRect(ctx, role, rect) {
    const w = rect.x2 - rect.x1, h = rect.y2 - rect.y1;
    const cx = (rect.x1 + rect.x2) / 2, cy = (rect.y1 + rect.y2) / 2;
    const maxSize = Math.min(h * 1.25, 160);
    const size = fitTextSize(ctx, role, 'Heaters', w * 0.9, h * 1.25, maxSize, 20, 'normal');
    ctx.fillStyle = CHARTE.night;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'normal ' + size + 'px "Heaters"';
    ctx.fillText(role, cx, cy);
  }

  function drawPhotoInCircle(ctx, img, spec) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(spec.cx, spec.cy, spec.r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max((spec.r * 2) / img.width, (spec.r * 2) / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, spec.cx - w / 2, spec.cy - h / 2, w, h);
    ctx.restore();
  }

  function drawZones(ctx, zonesAutorisees) {
    const autoriseesSet = new Set(zonesAutorisees.map(String));

    Object.keys(COORDS.zones).forEach((id) => {
      const z = COORDS.zones[id];
      const isAutorisee = autoriseesSet.has(String(id));

      if (isAutorisee) {
        // === Rendu ZONE AUTORISEE ===
        const rgb = hexToRgb(z.color);
        const isWhite = z.color.toLowerCase() === '#ffffff';

        // 1. Halo INTENSE compact autour de la pastille (rayon 1.4 × r)
        //    Pour zone 5 blanche : halo en bleu foncé pour se voir
        //    sur le fond blanc (au lieu de blanc invisible)
        ctx.save();
        const haloColor = isWhite ? { r: 0, g: 30, b: 45 } : rgb; // CHARTE.night pour zone 5
        const gradient = ctx.createRadialGradient(z.cx, z.cy, z.r * 1.0, z.cx, z.cy, z.r * 1.4);
        gradient.addColorStop(0,    'rgba(' + haloColor.r + ',' + haloColor.g + ',' + haloColor.b + ',0)');
        gradient.addColorStop(0.3,  'rgba(' + haloColor.r + ',' + haloColor.g + ',' + haloColor.b + ',0.9)');
        gradient.addColorStop(0.7,  'rgba(' + haloColor.r + ',' + haloColor.g + ',' + haloColor.b + ',0.5)');
        gradient.addColorStop(1,    'rgba(' + haloColor.r + ',' + haloColor.g + ',' + haloColor.b + ',0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Fill de la couleur zone opacity 0.5 pour saturer
        //    LE FOND sans écraser complètement le chiffre blanc
        //    du template en dessous (qui reste bien visible)
        //    Skip zone 5 blanche qu'on préserve
        if (!isWhite) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = z.color;
          ctx.beginPath();
          ctx.arc(z.cx, z.cy, z.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 3. Anneau blanc EPAIS qui couvre mécaniquement les ombres
        //    pastels du template. lineWidth 18, positionné à r+11
        //    → va de r+2 à r+20, couvre le halo pastel sans déborder
        //    sur la pastille voisine (espacement ~175 px, r=73)
        ctx.save();
        ctx.strokeStyle = isWhite ? CHARTE.night : '#FFFFFF';
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else {
        // === Rendu ZONE REFUSEE (occultation niveau 3) ===
        // Cercle noir plus large (r+18) pour couvrir la pastille
        // du template ET son halo/ombre pastel. Reste dans les
        // limites pour ne pas déborder sur la pastille voisine
        // (espacement ~175 px, marge disponible ~87 px de chaque côté).
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = CHARTE.night;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Silhouette pâle de la couleur zone pour rester lisible
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Chiffre pâle bien centré
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold ' + Math.round(z.r * 0.95) + 'px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(id, z.cx, z.cy);
        ctx.restore();
      }
    });
  }

  function drawQr(ctx, text, spec) {
    if (!text || typeof global.qrcode !== 'function') return;
    let qr;
    try { qr = global.qrcode(0, 'M'); qr.addData(text, 'Alphanumeric'); qr.make(); } catch (e) { console.warn('[accred] QR', e); return; }
    const n = qr.getModuleCount();
    const pad = 12;
    const cell = (spec.size - pad * 2) / n;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    const r = 14, x = spec.x, y = spec.y, w = spec.size, h = spec.size;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.fillStyle = CHARTE.night;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(Math.floor(x + pad + col * cell), Math.floor(y + pad + row * cell), Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
    ctx.restore();
  }

  async function render(canvas, params) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('render() : canvas invalide');
    }
    const ctx = canvas.getContext('2d');
    canvas.width  = COORDS.template_width;
    canvas.height = COORDS.template_height;

    const templatePath = params.templatePath || ASSETS.templatePath;
    const [templateImg, photoImg] = await Promise.all([
      loadImage(templatePath),
      loadImage(params.photoUrl),
      ensureFonts()
    ]);

    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
    drawPhotoInCircle(ctx, photoImg, COORDS.photo);

    const prenomUpper = (params.prenom || '').toUpperCase();
    const nomUpper    = (params.nom || '').toUpperCase();
    drawNomInRect(ctx, prenomUpper, nomUpper, COORDS.nom);

    const roleUpper = (params.roleLibelle || 'CLUB').toUpperCase();
    drawRoleInRect(ctx, roleUpper, COORDS.role);

    drawZones(ctx, params.zonesAutorisees || []);

    if (params.qrToken) drawQr(ctx, 'SPB:' + String(params.qrToken).toUpperCase(), COORDS.qr);
  }

  async function renderToPngBlob(params) {
    const canvas = document.createElement('canvas');
    await render(canvas, params);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Export PNG impossible')), 'image/png');
    });
  }

  async function downloadPng(params) {
    const blob = await renderToPngBlob(params);
    triggerDownload(blob, buildFileName(params, 'png'));
  }

  async function renderToPdfBlob(params) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('jsPDF non charge');
    }
    const canvas = document.createElement('canvas');
    await render(canvas, params);
    const versoImg = await loadImage(ASSETS.versoPath);

    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const rectoData = canvas.toDataURL('image/png');
    const r = fitImageToA4(canvas.width, canvas.height);
    pdf.addImage(rectoData, 'PNG', r.x, r.y, r.w, r.h);

    const vCanvas = document.createElement('canvas');
    vCanvas.width = versoImg.naturalWidth;
    vCanvas.height = versoImg.naturalHeight;
    vCanvas.getContext('2d').drawImage(versoImg, 0, 0);
    const versoData = vCanvas.toDataURL('image/png');
    const v = fitImageToA4(versoImg.naturalWidth, versoImg.naturalHeight);
    pdf.addPage();
    pdf.addImage(versoData, 'PNG', v.x, v.y, v.w, v.h);

    return pdf.output('blob');
  }

  async function downloadPdf(params) {
    const blob = await renderToPdfBlob(params);
    triggerDownload(blob, buildFileName(params, 'pdf'));
  }

  function fitImageToA4(imgW, imgH) {
    const pdfW = 210, pdfH = 297;
    const canvasRatio = imgW / imgH, pdfRatio = pdfW / pdfH;
    let w, h;
    if (canvasRatio > pdfRatio) { w = pdfW; h = pdfW / canvasRatio; }
    else { h = pdfH; w = pdfH * canvasRatio; }
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

  global.AccreditationGenerator = {
    render: render,
    downloadPng: downloadPng,
    downloadPdf: downloadPdf,
    renderToPdfBlob: renderToPdfBlob,
    renderToPngBlob: renderToPngBlob,
    ensureFonts: ensureFonts,
    drawQr: drawQr,
    buildFileName: buildFileName,
    _COORDS: COORDS,
    _CHARTE: CHARTE,
    _ASSETS: ASSETS
  };

})(window);
