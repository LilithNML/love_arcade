'use client';

import { useEffect, useRef } from 'react';

type Props = {
  engineName: string;
  scriptUrl: string;
  mountSelector?: string;
  onBeforeUnmount?: () => void;
};

export function GameEngineBridge({ engineName, scriptUrl, mountSelector = '[data-game-mount]', onBeforeUnmount }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.engine = engineName;

    const mountTarget = containerRef.current?.querySelector(mountSelector) ?? containerRef.current;
    if (mountTarget) {
      (window as any).__LOVE_ARCADE_GAME_MOUNT__ = mountTarget;
    }

    document.body.appendChild(script);

    return () => {
      onBeforeUnmount?.();
      script.remove();
      delete (window as any).__LOVE_ARCADE_GAME_MOUNT__;
      const gc = (window as any)[`${engineName}Cleanup`];
      if (typeof gc === 'function') gc();
      containerRef.current?.replaceChildren();
    };
  }, [engineName, mountSelector, onBeforeUnmount, scriptUrl]);

  return (
    <section ref={containerRef} data-engine={engineName}>
      <div data-game-mount />
    </section>
  );
}
