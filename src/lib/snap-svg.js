// src/lib/snap-svg.js
let Snap;

export function loadSnap() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined') {
      if (window.Snap) {
        Snap = window.Snap;
        resolve(Snap);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/snap.svg/0.5.1/snap.svg-min.js';
        script.onload = () => {
          Snap = window.Snap;
          resolve(Snap);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      }
    } else {
      resolve(null);
    }
  });
}