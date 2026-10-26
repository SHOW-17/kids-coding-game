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
const window = {addEventListener(){}};
vm.runInNewContext(script[1], {
  window, document, navigator:{},
  performance:{now:()=>1000},
  requestAnimationFrame:()=>0,
  cancelAnimationFrame(){},
  setTimeout:()=>0,clearTimeout(){}
});
const {m2,m3} = window.__uta;
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

console.log('PASS: ' + count + ' pitch cases, silence, adaptive modes, melody progression, pitch coach');