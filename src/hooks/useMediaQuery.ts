import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * The desktop and mobile shells are structurally different — a three-column
 * layout with a persistent transport versus a single scrolling column with a
 * tab bar — so they're separate trees swapped at this breakpoint rather than
 * one tree bent by CSS.
 */
export const useMediaQuery = (queryString: string): boolean => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(queryString).matches : false
  );

  useEffect(() => {
    const list = window.matchMedia(queryString);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [queryString]);

  return matches;
};

/** The mockups switch layout at the point the collections rail stops fitting. */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 900px)');
