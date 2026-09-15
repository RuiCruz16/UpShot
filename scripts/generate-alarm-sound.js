const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const AMPLITUDE = 0.68;

// Bright-but-melodic tone: fundamental + second + third harmonic, with a
// crisp attack and a short release so notes cut cleanly (no clicks).
function makeTone(freq, durationSec) {
  const samples = Math.floor(durationSec * SAMPLE_RATE);
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.008));
    const decay = Math.exp(-2.6 * t);
    const release = Math.min(1, (samples - i) / (SAMPLE_RATE * 0.02));
    const env = attack * decay * release;
    const partial =
      Math.sin(2 * Math.PI * freq * t) +
      0.32 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.16 * Math.sin(2 * Math.PI * freq * 3 * t);
    data[i] = partial * env * AMPLITUDE * (1 / 1.48);
  }
  return data;
}

function makeSilence(durationSec) {
  return new Float32Array(Math.floor(durationSec * SAMPLE_RATE));
}

// Melodic, wakeful motif in C major: C5 E5 G5 C6 G5 E5 (accent on the last G).
// Rounded values keep it pleasant; the rising shape and steady rhythm grab
// attention without being harsh.
const melody = [
  [523.25, 0.32], // C5
  [659.25, 0.32], // E5
  [783.99, 0.32], // G5
  [1046.5, 0.32], // C6
  [783.99, 0.32], // G5
  [659.25, 0.5], //  E5 (longer, accented resolution)
];
const NOTE_GAP = 0.07;
const PASS_GAP = 0.85;

const parts = [];
for (let pass = 0; pass < 2; pass++) {
  for (const [freq, seconds] of melody) {
    parts.push(makeTone(freq, seconds));
    parts.push(makeSilence(NOTE_GAP));
  }
  parts.push(makeSilence(PASS_GAP));
}
parts.push(makeSilence(0.6));

const totalSamples = parts.reduce((acc, part) => acc + part.length, 0);

const pcm = new Int16Array(totalSamples);
let offset = 0;
for (const samples of parts) {
  for (let i = 0; i < samples.length; i++) {
    pcm[offset++] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  }
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length * 2, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length * 2, 40);

const outPath = path.join(__dirname, '..', 'assets', 'alarm.wav');
fs.writeFileSync(outPath, Buffer.concat([header, Buffer.from(pcm.buffer)]));
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);