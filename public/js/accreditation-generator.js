/**
 * accreditation-generator.js — v2
 *
 * Changement v2 :
 *   - Halo autour de chaque pastille autorisée = COULEUR DE LA ZONE
 *     (au lieu d'un halo bleu DAY uniforme qui délavait tout)
 *   - Anneau blanc plus épais (10px au lieu de 6px)
 *   - Pour la zone 5 (blanche), anneau bleu foncé au lieu de blanc
 *     (sinon invisible sur fond blanc du halo)
 *   - Fill léger de la couleur zone par-dessus la pastille pour la saturer
 *
 * API publique inchangée :
 *   - AccreditationGenerator.render(canvas, params) → Promise<void>
 *   - AccreditationGenerator.downloadPng(params)     → Promise<void>
 *   - AccreditationGenerator.downloadPdf(params)     → Promise<void>
 *   - AccreditationGenerator.renderToBlob(params)    → Promise<Blob>  (nouveau, pour batch)
 */
(function (global) {
  'use strict';

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
      4: { label: 'Zone m\u00e9dias',  color: '#ef4444', cx: 722,  cy: 1417, r: 73 },
      5: { label: 'Salons VIP',        color: '#ffffff', cx: 897,  cy: 1419, r: 73 },
      6: { label: 'Espace b\u00e9n\u00e9voles', color: '#facc15', cx: 1071, cy: 1417, r: 73 }
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

  const imageCache = {};

  function loadImage(src) {
    if (imageCache[src]) return Promise.resolve(imageCache[src]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache[src] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('Impossible de charger : ' + src));
      img.src = src;
    });
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  function fitTextSize(ctx, text, fontFamily, maxWidth, maxHeight, maxSize, minSize) {
    minSize = minSize || 20;
    for (let size = maxSize; size >= minSize; size -= 2) {
      ctx.font = 'bold ' + size + 'px "' + fontFamily + '"';
      const metrics = ctx.measureText(text);
      if (metrics.width <= maxWidth && size <= maxHeight) return size;
    }
    return minSize;
  }

  function drawNomInRect(ctx, prenom, nom, rect) {
    const w  = rect.x2 - rect.x1;
    const h  = rect.y2 - rect.y1;
    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;
    const maxSize = Math.min(h * 0.42, 100);
    const size1 = fitTextSize(ctx, prenom, 'Sansation', w * 0.92, maxSize, maxSize);
    const size2 = fitTextSize(ctx, nom,    'Sansation', w * 0.92, maxSize, maxSize);
    const finalSize = Math.min(size1, size2);
    ctx.fillStyle    = CHARTE.night;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold ' + finalSize + 'px "Sansation"';
    const gap = finalSize * 0.15;
    ctx.fillText(prenom, cx, cy - (finalSize + gap) / 2);
    ctx.fillText(nom,    cx, cy + (finalSize + gap) / 2);
  }

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

  function drawZones(ctx, zonesAutorisees) {
    const autoriseesSet = new Set(zonesAutorisees.map(String));

    Object.keys(COORDS.zones).forEach((id) => {
      const z = COORDS.zones[id];
      const isAutorisee = autoriseesSet.has(String(id));

      if (isAutorisee) {
        // === Rendu ZONE AUTORISEE (v2 : plus vif, halo dans la couleur de la zone) ===
        const rgb = hexToRgb(z.color);
        const isWhite = z.color.toLowerCase() === '#ffffff';

        // 1. Halo LARGE dans la couleur de la zone (au lieu de bleu uniforme)
        ctx.save();
        const gradient = ctx.createRadialGradient(z.cx, z.cy, z.r * 0.9, z.cx, z.cy, z.r * 2.0);
        // Halo plus dense (opacity 0.85 au centre au lieu de 0.6)
        gradient.addColorStop(0,   'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.85)');
        gradient.addColorStop(0.4, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.4)');
        gradient.addColorStop(1,   'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 2.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Renforcement de la pastille : fill couleur zone opacity 0.55 par-dessus
        //    (donne un aspect plus saturé aux couleurs pastels du template)
        //    Sauf pour zone 5 (blanche) où on ne fait rien
        if (!isWhite) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = z.color;
          ctx.beginPath();
          ctx.arc(z.cx, z.cy, z.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 3. Anneau EPAIS autour de la pastille
        //    Blanc par défaut, mais bleu foncé pour la zone 5 (blanche)
        //    car sinon anneau blanc invisible sur halo blanc
        ctx.save();
        ctx.strokeStyle = isWhite ? CHARTE.night : '#FFFFFF';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else {
        // === Rendu ZONE REFUSEE (inchangé : occultation niveau 3) ===
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = CHARTE.night;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.cx, z.cy, z.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

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
      loadImage(params.photoUrl)
    ]);

    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
    drawPhotoInCircle(ctx, photoImg, COORDS.photo);

    const prenomUpper = (params.prenom || '').toUpperCase();
    const nomUpper    = (params.nom || '').toUpperCase();
    drawNomInRect(ctx, prenomUpper, nomUpper, COORDS.nom);

    const roleUpper = (params.roleLibelle || 'CLUB').toUpperCase();
    drawRoleInRect(ctx, roleUpper, COORDS.role);

    drawZones(ctx, params.zonesAutorisees || []);
  }

  async function downloadPng(params) {
    const canvas = document.createElement('canvas');
    await render(canvas, params);
    const filename = buildFileName(params, 'png');
    canvas.toBlob((blob) => {
      triggerDownload(blob, filename);
    }, 'image/png');
  }

  /**
   * NOUVEAU v2 : rend l'accréditation en Blob PDF (2 pages A4).
   * Utilisé pour le batch ZIP côté pilote sans déclencher de téléchargement.
   */
  async function renderToPdfBlob(params) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('jsPDF non chargé');
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
    vCanvas.width  = versoImg.naturalWidth;
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

  global.AccreditationGenerator = {
    render: render,
    downloadPng: downloadPng,
    downloadPdf: downloadPdf,
    renderToPdfBlob: renderToPdfBlob,   // nouveau, pour batch
    buildFileName: buildFileName,       // exposé pour cohérence des noms
    _COORDS: COORDS,
    _CHARTE: CHARTE,
    _ASSETS: ASSETS
  };

})(window);
