import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [relations, setRelations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationIdx, setLocationIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hitItems, setHitItems] = useState([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [expandedCaps, setExpandedCaps] = useState(new Set());
  const [expandedCults, setExpandedCults] = useState(new Set());
  const [visibleRelations, setVisibleRelations] = useState(new Map());
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const loadData = useCallback(async (keepSelectedId = null, keepView = false) => {
    try {
      const savedView = keepView ? view : null;
      const savedLocIdx = locationIdx;
      const [rels, locs] = await Promise.all([api.getRelations(), api.getLocations()]);
      setRelations(rels);
      setLocations(locs);
      const newIdx = Math.min(keepView ? savedLocIdx : locationIdx, locs.length - 1);
      setLocationIdx(Math.max(0, newIdx));
      if (savedView) setView(savedView);
      if (keepSelectedId && keepView) {
        // Re-find selected entity by ID after reload
        // hitItems will be updated by canvas after next render
      }
    } catch (e) {
      showToast('Kan data niet laden: ' + e.message, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationIdx, view, showToast]);

  const toggleCapExpanded = useCallback((assetId) => {
    setExpandedCaps(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
      return next;
    });
  }, []);

  const toggleCultExpanded = useCallback((ghId) => {
    setExpandedCults(prev => {
      const next = new Set(prev);
      if (next.has(ghId)) next.delete(ghId); else next.add(ghId);
      return next;
    });
  }, []);

  const toggleVisibleRelation = useCallback((id, payload) => {
    setVisibleRelations(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, payload);
      return next;
    });
  }, []);

  const refId = (ref) => ref?.Id ?? JSON.stringify(ref).slice(0, 32);

  const selectItem = useCallback((item) => {
    if (!item) { setSelected(null); return; }
    setSelected({ refId: refId(item.ref), payload: item });
  }, []);

  const selectDirect = useCallback((kind, ref, parents) => {
    setSelected({ refId: refId(ref), payload: { kind, ref, parents } });
  }, []);

  const findHitItem = useCallback((predicate) => hitItems.find(predicate), [hitItems]);

  const currentLocation = locations[locationIdx] || null;

  const value = {
    relations, setRelations,
    locations, setLocations,
    locationIdx, setLocationIdx,
    selected, setSelected, selectItem, selectDirect,
    hitItems, setHitItems, findHitItem,
    view, setView,
    expandedCaps, toggleCapExpanded,
    expandedCults, toggleCultExpanded,
    visibleRelations, toggleVisibleRelation,
    toast, showToast,
    modal, setModal,
    loadData,
    currentLocation,
    refId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
