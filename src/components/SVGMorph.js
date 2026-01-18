import { SVG } from '@svgdotjs/svg.js';
import faceSvg from './face.svg';
import mouthSvg from './mouth.svg';
import winkSvg from './wink.svg';

export async function setupSVGMorph(container) {
  // Create SVG drawing surface filling the container
  const draw = SVG()
    .addTo(container)
    .size('85%', '100%')
    // Set the viewBox so everything is scaled to fit
    .viewbox(0, 0, 10252.48, 9699.5886)
    // Ensure the aspect ratio is preserved (centered)
    .attr({ preserveAspectRatio: 'xMidYMid meet' });



  async function getSvgPaths(svgFile) {
    try {
      const response = await fetch(svgFile);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${svgFile}: ${response.statusText}`);
      }
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

      // Find all paths in the SVG
      const allPaths = Array.from(svgDoc.querySelectorAll('path')).map(path => ({
        d: path.getAttribute('d'),
        fill: path.getAttribute('fill'),
        stroke: path.getAttribute('stroke'),
        strokeWidth: path.getAttribute('stroke-width')
      }));

      // Find the path with id="animate"
      const animatedPath = svgDoc.querySelector('path#animate');
      return {
        allPaths,
        animatedPath: animatedPath
          ? {
              d: animatedPath.getAttribute('d'),
              fill: animatedPath.getAttribute('fill'),
              stroke: animatedPath.getAttribute('stroke'),
              strokeWidth: animatedPath.getAttribute('stroke-width')
            }
          : null
      };
    } catch (error) {
      console.error('Error in getSvgPaths:', error);
      return { allPaths: [], animatedPath: null };
    }
  }

  const { allPaths: facePaths, animatedPath: faceAnimated } = await getSvgPaths(faceSvg);
  const { animatedPath: mouthAnimated } = await getSvgPaths(mouthSvg);
  const { animatedPath: winkAnimated } = await getSvgPaths(winkSvg);

  // Create the face paths in the SVG.js draw
  const faceElements = facePaths.map(pathData =>
    draw
      .path(pathData.d)
      .fill(pathData.fill || '#343233')  // Use #343233 as default fill
      .stroke({ color: pathData.stroke || 'none', width: pathData.strokeWidth || 0 })
    );

  // Get index of the animated path
  const animatedPathIndex = facePaths.findIndex(path => faceAnimated && path.d === faceAnimated.d);

  // Store the different path states
  const states = {
    normal: faceAnimated?.d ?? '',
    mouth: mouthAnimated?.d ?? '',
    wink: winkAnimated?.d ?? ''
  };

  // Morph the animated path
  function morphTo(newState) {
    if (states[newState] && animatedPathIndex !== -1) {
      faceElements[animatedPathIndex].animate(300).plot(states[newState]);
    }
  }

  // Set initial state
  morphTo('normal');

  return morphTo;
}
