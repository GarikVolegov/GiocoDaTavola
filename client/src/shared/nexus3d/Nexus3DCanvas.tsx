import { useEffect, useRef, useState } from 'react';
import { NexusScene, isWebGLAvailable, type NexusVariant, type NexusState } from './nexusScene';

interface Nexus3DCanvasProps {
  variant?: NexusVariant;
  phase?: string;
  lean?: number;
  isRibaltone?: boolean;
  celebrate?: boolean;
}

export function Nexus3DCanvas({
  variant = 'player',
  phase = 'LOBBY',
  lean,
  isRibaltone,
  celebrate,
}: Nexus3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<NexusScene | null>(null);
  const [webglSupported] = useState(() => isWebGLAvailable());

  useEffect(() => {
    if (!webglSupported || !canvasRef.current) return;

    const initialLean =
      lean ??
      (() => {
        if (typeof document !== 'undefined') {
          const val = parseFloat(
            document.documentElement.style.getPropertyValue('--bivio-lean') || '50',
          );
          return isNaN(val) ? 50 : val;
        }
        return 50;
      })();

    const scene = new NexusScene(canvasRef.current, {
      variant,
      phase,
      lean: initialLean,
      isRibaltone,
      celebrate,
    });
    sceneRef.current = scene;

    // Observe --bivio-lean and data-phase changes on document.documentElement for host reactivity
    const checkCssLean = () => {
      const doc = document.documentElement;
      if (lean === undefined) {
        const cssVal = parseFloat(doc.style.getPropertyValue('--bivio-lean') || '50');
        if (!isNaN(cssVal)) {
          scene.updateState({ lean: cssVal });
        }
      }
      const domPhase = doc.getAttribute('data-phase');
      if (domPhase && (!phase || phase === 'LOBBY')) {
        scene.updateState({ phase: domPhase });
      }
    };

    const onShockwave = () => scene.triggerShockwave();
    window.addEventListener('nexus:shockwave', onShockwave);

    const observer = new MutationObserver(checkCssLean);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-phase'],
    });

    return () => {
      observer.disconnect();
      window.removeEventListener('nexus:shockwave', onShockwave);
      scene.destroy();
      sceneRef.current = null;
    };
  }, [webglSupported, variant]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const update: Partial<NexusState> = {
      variant,
      phase,
      isRibaltone,
      celebrate,
    };
    if (lean !== undefined) {
      update.lean = lean;
    }
    sceneRef.current.updateState(update);
  }, [phase, lean, isRibaltone, celebrate, variant]);

  if (!webglSupported) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="nexus-3d-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

export default Nexus3DCanvas;
