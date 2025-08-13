
import { useState, useEffect, useCallback } from 'react';

export function useMetadata() {
  // Settings state
  const [settings, setSettings] = useState({
    // UI Settings
    bgColor: 'linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)',
    scaleSize: 1.0,
    maxWidth: 700,
    padding: 10,
    fontFamily: 'Arial, sans-serif',
    fontColor: '#ffffff',
    textStroke: false,
    textStrokeSize: 0,
    textStrokeColor: 'rgba(0, 0, 0, 1)',
    playerLocationCoords: { x: 0, y: 0 },
    playerAlignment: 'right',
    
    // Service Settings
    twitchName: '',
    lastfmName: '',
    emoteSetId: '',
    
    // Emote Settings
    emoteLifetime: 5000,
    emoteScale: 1.0,
    emoteDelay: 150,
    subEffects: true,
    raidEffect: true,
    subEffectTypes: [],
    //HueShift
    subEffectHueShiftChance: 5,
    // Blackhole settings
    subEffectBlackHoleChance: 5,
    subEffectBlackHoleStrength: 0.0005,
    subEffectBlackHoleDuration: 5,
    //Reverse Gravity settings
    subEffectReverseGravityChance: 5,
    subEffectReverseGravityStrength: 0.002,
    subEffectReverseGravityDuration: 5
  });

  const [availableSubEffects, setAvailableSubEffects] = useState([]);
  const [version, setVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      
      // Helper function to safely parse numeric values
      const toNumber = (val, fallback) => {
        if (val == null) return fallback;
        if (typeof val === 'string') {
          const num = parseFloat(val.replace(/px$/i, ''));
          return isNaN(num) ? fallback : num;
        }
        return typeof val === 'number' ? val : fallback;
      };

      // Update settings with received data
      setSettings({
        // UI Settings
        bgColor: data.bgColor || 'linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)',
        scaleSize: toNumber(data.scaleSize, 1.0),
        maxWidth: toNumber(data.maxWidth, 700),
        padding: toNumber(data.padding, 10),
        fontFamily: data.fontFamily || 'Arial, sans-serif',
        fontColor: data.fontColor || '#ffffff',
        textStroke: Boolean(data.textStroke),
        textStrokeSize: toNumber(data.textStrokeSize, 0),
        textStrokeColor: data.textStrokeColor || 'rgba(0, 0, 0, 1)',
        playerLocationCoords: {
          x: toNumber(data.playerLocationX, 0),
          y: toNumber(data.playerLocationY, 0)
        },
        playerAlignment: data.playerAlignment || 'right',
        
        // Service Settings
        twitchName: data.twitchName || '',
        lastfmName: data.lastfmName || '',
        emoteSetId: data.emoteSetId || '',
        
        // Emote Settings
        emoteLifetime: toNumber(data.emoteLifetime, 5000),
        emoteScale: toNumber(data.emoteScale, 1.0),
        emoteDelay: toNumber(data.emoteDelay, 150),
        subEffects: Boolean(data.subEffects),
        raidEffect: Boolean(data.raidEffect),
        subEffectTypes: Array.isArray(data.subEffectTypes)
          ? data.subEffectTypes
          : typeof data.subEffectTypes === 'string' && data.subEffectTypes.length > 0
            ? [data.subEffectTypes]
            : [],
        //HueShift
        subEffectHueShiftChance: toNumber(data.subEffectHueShiftChance, 5),
        //blackhole
        subEffectBlackHoleChance: toNumber(data.subEffectBlackHoleChance, 5),
        subEffectBlackHoleDuration: toNumber(data.subEffectBlackHoleDuration, 5),
        subEffectBlackHoleStrength: toNumber(data.subEffectBlackHoleStrength, 0.00005),
        //reverse gravity
        subEffectReverseGravityChance: toNumber(data.subEffectReverseGravityChance, 5),
        subEffectReverseGravityDuration: toNumber(data.subEffectReverseGravityDuration, 5),
        subEffectReverseGravityStrength: toNumber(data.subEffectReverseGravityStrength, 0.002),
      });
      
      setError(null);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available sub effects
  const fetchSubEffectTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/subeffecttypes');
      if (!response.ok) throw new Error('Failed to fetch sub effect types');
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setAvailableSubEffects(data);
      }
    } catch (err) {
      console.error('Error fetching sub effect types:', err);
    }
  }, []);

  // Fetch version information
  const fetchVersionInfo = useCallback(async () => {
    try {
      // Get current version
      const currentVersionRes = await fetch('/api/currentversion');
      if (currentVersionRes.ok) {
        const currentData = await currentVersionRes.json();
        if (currentData.version) setVersion(currentData.version);
      }
      
      // Get latest version
      const latestVersionRes = await fetch('/api/latestversion');
      if (latestVersionRes.ok) {
        const latestData = await latestVersionRes.json();
        if (latestData.version) setLatestVersion(latestData.version);
      }
    } catch (err) {
      console.error('Error fetching version info:', err);
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async (key, value) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      
      if (!response.ok) throw new Error(`Failed to update ${key}`);
      
      // Update local state
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Refresh the application
      await fetch('/api/refresh', { method: 'POST' });
      console.log("Refresh Event dispatch");
      
      return true;
    } catch (err) {
      console.error(`Error updating setting ${key}:`, err);
      return false;
    }
  }, []);

  // Bulk update multiple settings at once
  const updateSettings = useCallback(async (updatedSettings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      
      if (!response.ok) throw new Error('Failed to update settings');
      
      // Update local state
      setSettings(prev => ({ ...prev, ...updatedSettings }));
      
      // Refresh the application
      await fetch('/api/refresh', { method: 'POST' });
      console.log("Refresh Event dispatch");
      
      return true;
    } catch (err) {
      console.error('Error updating settings:', err);
      return false;
    }
  }, []);

  // Load all data on initial mount
  useEffect(() => {
    const loadAllData = async () => {
      await fetchSettings();
      await fetchSubEffectTypes();
      await fetchVersionInfo();
    };
    
    loadAllData();
  }, [fetchSettings, fetchSubEffectTypes, fetchVersionInfo]);

  return {
    settings,
    availableSubEffects,
    version,
    latestVersion,
    isLoading,
    error,
    updateSetting,
    updateSettings,
    refreshSettings: fetchSettings,
  };
}