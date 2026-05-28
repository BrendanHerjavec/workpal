// Sprite renderer — returns an SVG string for a given stage + mood.
// Pixel-art-ish using <rect> blocks on a small grid scaled up.

const MOOD_COLORS = {
  dying:       { body: '#9aa0a6', cheek: '#6b7178', outline: '#3c4043' },
  sad:         { body: '#a7b8d6', cheek: '#7c8db0', outline: '#3c4043' },
  neutral:     { body: '#ffe9a8', cheek: '#f5c46a', outline: '#3c4043' },
  happy:       { body: '#ffd34d', cheek: '#ff9f3b', outline: '#3c4043' },
  thriving:    { body: '#ffdd55', cheek: '#ff8a3b', outline: '#3c4043' },
  loved:       { body: '#ffc1d8', cheek: '#ff6fa6', outline: '#3c4043' },
  caffeinated: { body: '#fff3a0', cheek: '#ffb74d', outline: '#3c4043' },
  sleepy:      { body: '#cdb6f0', cheek: '#9a7ec9', outline: '#3c4043' },
  panicked:    { body: '#ffb59e', cheek: '#e57373', outline: '#3c4043' },
  bored:       { body: '#dfe3e8', cheek: '#9aa0a6', outline: '#3c4043' },
  focused:     { body: '#aee2ff', cheek: '#4fc3f7', outline: '#3c4043' }
};

// Draw helpers using a 16x16 logical grid scaled to 128x128 view.
const CELL = 8;
const SIZE = 16;
function rect(x, y, w, h, fill) {
  return `<rect x="${x*CELL}" y="${y*CELL}" width="${w*CELL}" height="${h*CELL}" fill="${fill}"/>`;
}

function bodyShape(stage, c) {
  // Returns rects for the creature body silhouette per stage.
  const o = c.outline, b = c.body;
  switch (stage) {
    case 0: { // Egg — proper oval with pointed top, rounded bottom
      // Row layout: [y, leftX, width]
      const rows = [
        [2, 7, 2],
        [3, 6, 4],
        [4, 5, 6],
        [5, 5, 6],
        [6, 4, 8],
        [7, 4, 8],
        [8, 4, 8],
        [9, 4, 8],
        [10, 4, 8],
        [11, 4, 8],
        [12, 5, 6],
        [13, 6, 4]
      ];
      const parts = [];
      // Fill body
      for (const [y, x, w] of rows) parts.push(rect(x, y, w, 1, b));
      // Outline edges
      for (const [y, x, w] of rows) {
        parts.push(rect(x, y, 1, 1, o));
        parts.push(rect(x + w - 1, y, 1, 1, o));
      }
      // Speckles for an egg-ish look
      parts.push(rect(6, 8, 1, 1, c.cheek));
      parts.push(rect(9, 10, 1, 1, c.cheek));
      parts.push(rect(7, 6, 1, 1, c.cheek));
      return parts.join('');
    }
    case 1: // Blob
      return [
        rect(5,4,6,1,o),
        rect(4,5,8,1,o),
        rect(3,6,10,1,o),
        rect(3,7,10,6,b),
        rect(3,7,1,6,o),
        rect(12,7,1,6,o),
        rect(4,13,8,1,o)
      ].join('');
    case 2: // Sprout — blob + leaf
      return [
        rect(8,2,1,1,'#4caf50'),
        rect(7,3,2,1,'#4caf50'),
        rect(8,3,1,1,'#2e7d32'),
        rect(5,4,6,1,o),
        rect(4,5,8,1,o),
        rect(3,6,10,1,o),
        rect(3,7,10,6,b),
        rect(3,7,1,6,o),
        rect(12,7,1,6,o),
        rect(4,13,8,1,o)
      ].join('');
    case 3: // Junior — blob with a tiny tie
      return [
        rect(5,3,6,1,o),
        rect(4,4,8,1,o),
        rect(3,5,10,1,o),
        rect(3,6,10,7,b),
        rect(3,6,1,7,o),
        rect(12,6,1,7,o),
        rect(4,13,8,1,o),
        rect(7,9,2,1,'#c62828'), // tie knot
        rect(7,10,2,3,'#e53935')
      ].join('');
    case 4: // Senior — bigger, glasses, tie
      return [
        rect(4,2,8,1,o),
        rect(3,3,10,1,o),
        rect(2,4,12,1,o),
        rect(2,5,12,9,b),
        rect(2,5,1,9,o),
        rect(13,5,1,9,o),
        rect(3,14,10,1,o),
        rect(4,7,2,2,o),  // glasses L
        rect(10,7,2,2,o), // glasses R
        rect(6,8,4,1,o),  // glasses bridge
        rect(7,10,2,1,'#1a237e'),
        rect(7,11,2,3,'#3949ab')
      ].join('');
    case 5: // Executive — suit, briefcase
      return [
        rect(4,2,8,1,o),
        rect(3,3,10,1,o),
        rect(2,4,12,1,o),
        rect(2,5,12,4,b),
        rect(2,5,1,9,o),
        rect(13,5,1,9,o),
        // suit jacket
        rect(2,9,12,5,'#263238'),
        rect(7,9,2,5,'#eceff1'), // shirt strip
        rect(7,10,2,1,'#b71c1c'), // tie
        rect(7,11,2,2,'#d32f2f'),
        rect(3,14,10,1,o),
        // briefcase next to body
        rect(0,11,2,3,'#3e2723'),
        rect(0,11,2,1,o)
      ].join('');
    default:
      return rect(4,6,8,7,b);
  }
}

function face(stage, mood, c) {
  // Default eye/mouth coords scale with stage size.
  const eyeY = stage >= 4 ? 7 : 8;
  const eyeLX = stage >= 4 ? 5 : 5;
  const eyeRX = stage >= 4 ? 10 : 9;
  const mouthY = stage >= 4 ? 11 : 10;
  const mouthX = stage >= 4 ? 7 : 7;
  const o = c.outline;

  let eyes = '';
  let mouth = '';

  switch (mood) {
    case 'dying':
      eyes = rect(eyeLX, eyeY, 1, 1, o) + rect(eyeLX+1, eyeY+1, 1, 1, o) +
             rect(eyeRX, eyeY, 1, 1, o) + rect(eyeRX-1, eyeY+1, 1, 1, o); // X eyes
      mouth = rect(mouthX, mouthY, 2, 1, o);
      break;
    case 'sad':
      eyes = rect(eyeLX, eyeY+1, 1, 1, o) + rect(eyeRX, eyeY+1, 1, 1, o);
      mouth = rect(mouthX, mouthY+1, 2, 1, o) + rect(mouthX-1, mouthY, 1, 1, o) + rect(mouthX+2, mouthY, 1, 1, o);
      break;
    case 'neutral':
      eyes = rect(eyeLX, eyeY, 1, 1, o) + rect(eyeRX, eyeY, 1, 1, o);
      mouth = rect(mouthX, mouthY, 2, 1, o);
      break;
    case 'happy':
      eyes = rect(eyeLX, eyeY, 1, 1, o) + rect(eyeRX, eyeY, 1, 1, o);
      mouth = rect(mouthX-1, mouthY, 1, 1, o) + rect(mouthX, mouthY+1, 2, 1, o) + rect(mouthX+2, mouthY, 1, 1, o);
      // cheeks
      mouth += rect(eyeLX-1, eyeY+1, 1, 1, c.cheek) + rect(eyeRX+1, eyeY+1, 1, 1, c.cheek);
      break;
    case 'thriving':
      eyes = rect(eyeLX, eyeY-1, 1, 2, '#ffd700') + rect(eyeRX, eyeY-1, 1, 2, '#ffd700');
      mouth = rect(mouthX-1, mouthY, 4, 1, o) + rect(mouthX, mouthY+1, 2, 1, o);
      break;
    case 'loved':
      // Heart-shaped eyes
      eyes = rect(eyeLX, eyeY, 1, 1, '#e91e63') + rect(eyeLX+1, eyeY, 1, 1, '#e91e63') +
             rect(eyeLX, eyeY+1, 2, 1, '#e91e63') + rect(eyeLX+1, eyeY+2, 1, 1, '#e91e63') +
             rect(eyeRX, eyeY, 1, 1, '#e91e63') + rect(eyeRX-1, eyeY, 1, 1, '#e91e63') +
             rect(eyeRX-1, eyeY+1, 2, 1, '#e91e63') + rect(eyeRX-1, eyeY+2, 1, 1, '#e91e63');
      mouth = rect(mouthX-1, mouthY, 1, 1, o) + rect(mouthX, mouthY+1, 2, 1, o) + rect(mouthX+2, mouthY, 1, 1, o);
      break;
    case 'caffeinated':
      // Huge wide eyes + open mouth
      eyes = rect(eyeLX-1, eyeY-1, 3, 3, '#fff') + rect(eyeLX, eyeY, 1, 1, o) +
             rect(eyeRX-1, eyeY-1, 3, 3, '#fff') + rect(eyeRX, eyeY, 1, 1, o);
      mouth = rect(mouthX, mouthY, 2, 2, o);
      break;
    case 'sleepy':
      // Closed-eye dashes
      eyes = rect(eyeLX-1, eyeY+1, 3, 1, o) + rect(eyeRX-1, eyeY+1, 3, 1, o);
      mouth = rect(mouthX, mouthY+1, 2, 1, o);
      break;
    case 'panicked':
      // Tiny dot eyes inside big whites, "O" mouth
      eyes = rect(eyeLX-1, eyeY-1, 3, 3, '#fff') + rect(eyeLX, eyeY, 1, 1, o) +
             rect(eyeRX-1, eyeY-1, 3, 3, '#fff') + rect(eyeRX, eyeY, 1, 1, o);
      mouth = rect(mouthX, mouthY, 2, 1, o) + rect(mouthX-1, mouthY+1, 1, 1, o) + rect(mouthX+2, mouthY+1, 1, 1, o) + rect(mouthX, mouthY+2, 2, 1, o);
      break;
    case 'bored':
      // Half-lidded eyes, flat mouth
      eyes = rect(eyeLX-1, eyeY, 3, 1, o) + rect(eyeRX-1, eyeY, 3, 1, o);
      mouth = rect(mouthX, mouthY+1, 2, 1, o);
      break;
    case 'focused':
      // Determined squint, slight frown of concentration
      eyes = rect(eyeLX, eyeY, 1, 1, o) + rect(eyeLX-1, eyeY-1, 1, 1, o) +
             rect(eyeRX, eyeY, 1, 1, o) + rect(eyeRX+1, eyeY-1, 1, 1, o);
      mouth = rect(mouthX, mouthY, 2, 1, o);
      break;
  }
  return eyes + mouth;
}

function overlays(mood) {
  switch (mood) {
    case 'dying':
      return `
        <text x="${13*CELL}" y="${4*CELL}" font-family="monospace" font-size="${CELL*1.5}" fill="#3c4043">?!</text>
        <rect x="${2*CELL}" y="${4*CELL}" width="${CELL}" height="${CELL*1.5}" fill="#90caf9" rx="2"/>
      `;
    case 'sad':
      return `<rect x="${2*CELL}" y="${10*CELL}" width="${CELL*2}" height="${CELL*3}" fill="#212121" rx="1"/>
              <rect x="${2*CELL+2}" y="${10*CELL+2}" width="${CELL*2-4}" height="${CELL*3-4}" fill="#1e88e5"/>`;
    case 'thriving':
      return `
        <circle cx="${2*CELL}" cy="${3*CELL}" r="3" fill="#ffd700"/>
        <circle cx="${13*CELL}" cy="${2*CELL}" r="2" fill="#ff80ab"/>
        <circle cx="${14*CELL}" cy="${6*CELL}" r="2" fill="#80d8ff"/>
        <circle cx="${1*CELL}" cy="${7*CELL}" r="2" fill="#b9f6ca"/>
      `;
    case 'loved':
      return `
        <text x="${1*CELL}" y="${3*CELL}" font-size="${CELL*1.4}" fill="#e91e63">♥</text>
        <text x="${13*CELL}" y="${4*CELL}" font-size="${CELL*1.2}" fill="#ff80ab">♥</text>
      `;
    case 'caffeinated':
      // jittery steam lines + tiny cup
      return `
        <rect x="${13*CELL}" y="${10*CELL}" width="${CELL*2}" height="${CELL*2}" fill="#6d4c41"/>
        <rect x="${13*CELL+2}" y="${10*CELL+2}" width="${CELL*2-4}" height="${CELL-4}" fill="#a47148"/>
        <path d="M${13*CELL+4} ${9*CELL} q4 -4 0 -8" stroke="#bbb" stroke-width="1" fill="none"/>
        <path d="M${13*CELL+10} ${9*CELL} q-4 -4 0 -8" stroke="#bbb" stroke-width="1" fill="none"/>
      `;
    case 'sleepy':
      // Z's
      return `
        <text x="${12*CELL}" y="${4*CELL}" font-family="monospace" font-weight="bold" font-size="${CELL*1.5}" fill="#3c4043">Z</text>
        <text x="${13*CELL+2}" y="${2*CELL+2}" font-family="monospace" font-weight="bold" font-size="${CELL}" fill="#3c4043">z</text>
      `;
    case 'panicked':
      // sweat drops on both sides + "!!" bubble
      return `
        <text x="${12*CELL+4}" y="${4*CELL}" font-family="monospace" font-weight="bold" font-size="${CELL*1.5}" fill="#d32f2f">!!</text>
        <rect x="${1*CELL}" y="${5*CELL}" width="${CELL-2}" height="${CELL*1.4}" fill="#90caf9" rx="2"/>
        <rect x="${14*CELL}" y="${5*CELL}" width="${CELL-2}" height="${CELL*1.4}" fill="#90caf9" rx="2"/>
      `;
    case 'bored':
      // a little fly buzzing
      return `<text x="${13*CELL}" y="${3*CELL}" font-size="${CELL}" fill="#3c4043">~</text>`;
    case 'focused':
      // tiny floating spreadsheet / lines
      return `
        <rect x="${0}" y="${2*CELL}" width="${CELL*2}" height="${CELL*1.5}" fill="#fff" stroke="#3c4043" stroke-width="0.5"/>
        <line x1="0" y1="${2*CELL+4}" x2="${CELL*2}" y2="${2*CELL+4}" stroke="#3c4043" stroke-width="0.5"/>
      `;
    default:
      return '';
  }
}

export function spriteSVG(stage, mood) {
  const c = MOOD_COLORS[mood] || MOOD_COLORS.neutral;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE*CELL} ${SIZE*CELL}" shape-rendering="crispEdges" width="100%" height="100%">
      ${bodyShape(stage, c)}
      ${face(stage, mood, c)}
      ${overlays(mood)}
    </svg>
  `;
}

export function stageScale(stage) {
  // Pet grows physically with stage.
  return 0.6 + stage * 0.08;
}
