import { useState, useEffect, useCallback } from 'react';

/**
 * useGeolocation — wraps navigator.geolocation
 * Automatically requests location on mount.
 * Exposes manual retry and error state.
 */
export function useGeolocation() {
  const [state, setState] = useState({
    lat: null,
    lon: null,
    loading: true,
    error: null,
    denied: false,
  });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ lat: null, lon: null, loading: false, error: 'Geolocation not supported by your browser.', denied: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          loading: false,
          error: null,
          denied: false,
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState({
          lat: null,
          lon: null,
          loading: false,
          error: denied
            ? 'Location access denied. Please use the search box to enter a city.'
            : 'Could not get your location. Please try again.',
          denied,
        });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => { request(); }, [request]);

  return { ...state, retry: request };
}
