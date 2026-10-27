/* Regression tests for うたあそび. Run: npm run test:uta */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../games/uta.html'), 'utf8');
const script = html.match(/<script>\s*(\/\*[\s\S]*?)<\/script>/);
assert(script, 'uta script found');
new Function(script[1]); // catch JavaScript syntax errors

const pitchCode = script[1].match(/function detectPitch\(buf, sr\)\{[\s\S]*?\n\}/);
assert(pitchCode, 'pitch detector present');
const pitch = new Function('clamp', pitchCode[0] + '\nreturn detectPitch;')(
  (v, a, b) => Math.max(a, Math.min(b, v))
);
let count = 0;
for (const sr of [44100, 48000]) {
  for (const f of [130.81, 146.83, 196, 261.63, 329.63, 440, 523.25, 587.33, 659.25, 694]) {
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) {
      const t = i / sr;
      buf[i] = .7 * Math.sin(2 * Math.PI * f * t)
             + .14 * Math.sin(4 * Math.PI * f * t)
             + .07 * Math.sin(6 * Math.PI * f * t);
    }
    const found = pitch(buf, sr);
    assert(found > 0 && Math.abs(12 * Math.log2(found / f)) < .5,
      'pitch mismatch at ' + f + ' Hz / ' + sr + ' Hz: ' + found);
    count++;
  }
}
assert.equal(pitch(new Float32Array(2048), 48000), 0, 'silence must not count');

// Microphone offset / low rumble must read as "no voice" (not a fake ~700 Hz voice).
function noiseBuf(sr, fn) {
  const buf = new Float32Array(2048);
  for (let i = 0; i < buf.length; i++) buf[i] = fn(i / sr, i);
  return buf;
}
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - .5;
for (const sr of [44100, 48000]) {
  for (let ph = 0; ph < 6; ph++) {
    const cases = {
      'DC 0.05': () => .05,
      '20 Hz rumble': t => .1 * Math.sin(2 * Math.PI * 20 * t + ph),
      '40 Hz rumble': t => .1 * Math.sin(2 * Math.PI * 40 * t + ph),
      '20+40 Hz': t => .06 * Math.sin(2 * Math.PI * 20 * t + ph) + .06 * Math.sin(2 * Math.PI * 40 * t),
      'DC 0.02 + weak noise': () => .02 + .008 * rnd(),
    };
    for (const [name, fn] of Object.entries(cases)) {
      assert.equal(pitch(noiseBuf(sr, fn), sr), 0, name + ' must be silent @' + sr + ' phase ' + ph);
      count++;
    }
  }
  // Voice above the range or with vibrato near the top must never be read an octave low.
  for (const f of [694, 740, 784, 880]) {
    for (let ph = 0; ph < 12; ph++) {
      const buf = noiseBuf(sr, t => {
        const ff = f * Math.pow(2, (f === 694 ? 50 : 0) / 1200 * Math.sin(2 * Math.PI * 5.5 * t + ph));
        return .7 * Math.sin(2 * Math.PI * ff * t) + .14 * Math.sin(4 * Math.PI * ff * t);
      });
      const found = pitch(buf, sr);
      assert(found === 0 || Math.abs(1200 * Math.log2(found / f)) < 120,
        'no octave-down at ' + f + ' Hz @' + sr + ': ' + found);
      count++;
    }
  }
}

// Minimal DOM mock to exercise gameplay state and visual-coach decisions.
// Real microphones and device rendering still require on-device testing.
const nodes = new Map();
function elem() {
  const attrs = {};
  return {
    style: {}, classList: {add(){},remove(){},toggle(){}},
    setAttribute(k,v){ attrs[k] = v; },
    getAttribute(k){ return attrs[k]; },
    textContent: '', innerHTML: '', hidden: false,
    addEventListener(){}, appendChild(){}, remove(){},
    querySelector(){ return elem(); },
    getBoundingClientRect(){ return {left:0,top:0,width:200,height:200}; },
    clientWidth:300,clientHeight:300,offsetHeight:92,offsetWidth:76
  };
}
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id,elem());
    return nodes.get(id);
  },
  createElement(){return elem();},
  addEventListener(){}
};
const sounds = [];
const Sfx = new Proxy({}, {get:(o,k)=>()=>sounds.push(String(k))});
const FX = new Proxy({}, {get:(o,k)=>()=>sounds.push('fx:'+String(k))});
const window = {addEventListener(){}, Sfx, FX};
vm.runInNewContext(script[1], {
  window, document, navigator:{}, Sfx, FX,
  performance:{now:()=>1000},
  requestAnimationFrame:()=>0,
  cancelAnimationFrame(){},
  setTimeout:()=>0,clearTimeout(){}
});
const {m2,m3,mic,voice,pitchGuide,pitchOk} = window.__uta;
const sung = [];
voice.sing = f => sung.push(f);
m2.setMode(false);
assert.equal(m2.practice,false);
assert.equal(document.getElementById('m2Challenge').getAttribute('aria-pressed'),'true');
m2.setMode(true);
assert.equal(m2.practice,true);
assert.equal(document.getElementById('m2Skip').hidden,false);

m2.samples = Array(20).fill(146.83);
m2.fitVoice();
assert.equal(m2.activeNotes.length,5);
assert(m2.activeNotes.some(n=>Math.abs(n.f-146.83)<1));
assert(m2.activeNotes.every(n=>n.f<=293.66));
m2.samples = Array(20).fill(600);
m2.fitVoice();
assert(m2.activeNotes.some(n=>n.f>=587));

[1,2,2,3,4].forEach((length,i)=>{
  for(let j=0;j<12;j++){
    const notes=m3.genPhrase(i);
    assert.equal(notes.length,length);
    assert(notes.every(n=>n>=0&&n<=5));
  }
});
m3.phase='play';
m3.coach(392,392);
assert.equal(document.getElementById('coachFeedback').textContent,'ぴったり！');
m3.coach(350,392);
assert.match(document.getElementById('coachFeedback').textContent,/たかく/);
m3.coach(440,392);
assert.match(document.getElementById('coachFeedback').textContent,/ひくく/);
m3.coach(0,392);
assert.match(document.getElementById('coachFeedback').textContent,/こえ/);

// Coach direction follows the real pitch (no ±600-cent wrap): 6 notes x 5 others = 30 pairs.
let pairs = 0;
for (const target of m3.NOTES) {
  for (const f of m3.NOTES) {
    if (f === target) continue;
    for (const stuck of [0, 9]) {
      m3.stuck = stuck;
      m3.coach(f, target);
      const text = document.getElementById('coachFeedback').textContent;
      const tol = stuck >= 8 ? 200 : 100;
      if (pitchOk(f, target, tol)) assert.equal(text, 'ぴったり！', f + ' for ' + target);
      else if (f > target) assert.match(text, /ひくく/, 'sang ' + f + ' for ' + target + ': ' + text);
      else assert.match(text, /たかく/, 'sang ' + f + ' for ' + target + ': ' + text);
    }
    pairs++;
  }
}
assert.equal(pairs, 30);
m3.stuck = 0;
// Reviewer examples, and a sweep over every child-range voice: never the opposite way.
m3.coach(392, 261.63);
assert.match(document.getElementById('coachFeedback').textContent, /ひくく/, 'G4 for C4 → lower');
m3.coach(293.66, 523.25);
assert.match(document.getElementById('coachFeedback').textContent, /たかく/, 'D4 for C5 → higher');
for (const target of m3.NOTES) {
  for (let f = 220; f <= 700; f *= Math.pow(2, 1 / 48)) {
    const g = pitchGuide(f, target, 100);
    if (g.dir !== 0) assert.equal(g.dir, f < target ? 1 : -1, f + ' for ' + target);
  }
}
// A parent's low voice an octave below is "just right", like the judge.
assert.equal(pitchGuide(196, 392, 100).dir, 0);

// ② practice ring: stops, sings the model once, helps at 8 s, moves on at 15 s.
function runLoop(game, seconds, t0) {
  let t = t0;
  for (let i = 0; i < seconds * 20; i++) { t += 50; game.loop(t); }
  return t;
}
mic.read = () => 0;
m2.stopGame();
m2.active = true; m2.calibrating = false; m2.practice = true;
m2.idx = 0; m2.popped = 0;
m2.activeNotes = [{f: 392, label: 'そ'}];
sung.length = 0;
m2.spawn();
assert.equal(sung.length, 1, 'model voice when the ring appears');
let t = runLoop(m2, 6, 10000);
assert(m2.ring && m2.ring.stopped, 'practice ring waits in front of the unicorn');
assert.equal(sung.length, 2, 'model voice once more when it stops');
assert(m2.earBlockUntil > t - 6000, 'mic judging paused while the model sings');
const ring = m2.ring;
t = runLoop(m2, 8.2, t);
assert(ring.helped && sung.length === 3, 'help + model again after 8 s');
assert(m2.tolSemis(ring) > m2.tolSemis(null), 'tolerance widened after help');
t = runLoop(m2, 7.5, t);
assert.equal(m2.ring, null, 'moves on by itself after 15 s');
assert.equal(m2.popped, 0);
// Switching speed mid-game keeps progress instead of silently restarting.
m2.idx = 3; m2.popped = 2;
m2.setMode(false);
assert.equal(m2.practice, false);
assert.equal(m2.idx, 3); assert.equal(m2.popped, 2);
m2.setMode(true);
m2.stopGame();
// Voice-range check needs enough voice and a stable range.
m2.activeNotes = [];
m2.samples = Array(10).fill(600);
m2.fitVoice();
assert.equal(m2.activeNotes.length, 0, 'too few samples keep the default notes');
m2.samples = Array(15).fill(150).concat(Array(15).fill(600));
m2.fitVoice();
assert.equal(m2.activeNotes.length, 0, 'scattered samples keep the default notes');

// ③ a note caught after the hint (8–18 s, ±200 cents) counts as "together", not "by yourself".
function m3Play(phrase) {
  m3.stopGame(); m3.build();
  m3.active = true; m3.phase = 'play';
  m3.phrase = phrase; m3.ni = 0; m3.hold = 0; m3.phraseHelped = false;
  m3.cleanNotes = 0; m3.assistedNotes = 0; m3.earBlockUntil = 0;
  m3.setAim(0);
}
m3Play([3, 0]);   // 2音目は C4＝この声では とれない
mic.read = () => 392 * Math.pow(2, 1.5 / 12);   // 150 cents sharp: only OK after the hint
m3.stuck = 9;
t = runLoop(m3, 2.5, 20000);
assert.equal(m3.assistedNotes, 1, 'post-hint success is assisted');
assert.equal(m3.cleanNotes, 0);
assert(m3.phraseHelped);
m3Play([3]);
mic.read = () => 392;
t = runLoop(m3, 1, t + 1000);
assert.equal(m3.cleanNotes, 1, 'on-pitch on its own is clean');
assert.equal(m3.assistedNotes, 0);
// Assisted-only round: no fanfare / confetti.
m3.cleanNotes = 0; m3.assistedNotes = 5; sounds.length = 0;
m3.end();
assert(sounds.includes('success'), sounds.join(','));
assert(!sounds.includes('fanfare') && !sounds.includes('fx:celebrate'), sounds.join(','));
m3.cleanNotes = 4; m3.assistedNotes = 1; sounds.length = 0;
m3.end();
assert(sounds.includes('fanfare'));

console.log('PASS: ' + count + ' pitch cases (incl. DC/rumble/high voice), silence, adaptive modes, melody progression, ' +
  'pitch coach (30 pairs), practice ring timers, assisted vs clean notes');