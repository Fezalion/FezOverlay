import { useState, useEffect, useCallback, useRef } from "react";

export function useMetadata() {
  // Settings state
  const [settings, setSettings] = useState({
    // UI Settings
    bgColor: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)",
    scaleSize: 1.0,
    maxWidth: 700,
    padding: 10,
    fontFamily: "Arial, sans-serif",
    fontColor: "#ffffff",
    textStroke: false,
    textStrokeSize: 0,
    textStrokeColor: "rgba(0, 0, 0, 1)",
    playerLocationCoords: { x: 0, y: 0 },
    playerAlignment: "right",
    scrollSpeed: 25,
    hideOnNothing: false,

    //YapMeter Settings
    yapMeterThreshold: 1.0,
    yapMeterSilenceThreshold: 3,
    yapMeterMaxYap: 60,
    yapMeterLength: 300,

    // Service Settings
    twitchName: "",
    lastfmName: "",
    emoteSetId: "",

    // Emote Settings
    emoteLifetime: 5000,
    emoteScale: 1.0,
    emoteDelay: 150,
    subEffects: true,
    raidEffect: true,
    subEffectTypes: [],
    subOnlyMode: false,
    //HueShift
    subEffectHueShiftChance: 5,
    // Blackhole settings
    subEffectBlackHoleChance: 5,
    subEffectBlackHoleStrength: 5,
    subEffectBlackHoleDuration: 5,
    //Reverse Gravity settings
    subEffectReverseGravityChance: 5,
    subEffectReverseGravityStrength: 2,
    subEffectReverseGravityDuration: 5,
    //No Gravity settings
    subEffectNoGravityChance: 5,
    subEffectNoGravityDuration: 5,
    // Battle Event settings
    battleEventChance: 5,
    battleEventParticipants: 8,
    battleEventHp: 300,
    battleEventDamage: 50,
    battleEventDuration: 60,
    battleEventDPSTracker: true,
    battleEventDPSTrackerLive: true,
    battleEventDPSTrackerFloatLeft: false,
    battleEventAcceptPlebs: false,
    battleEventShowSkillHistory: true,
  });

  const [availableSubEffects, setAvailableSubEffects] = useState([]);
  const [version, setVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref for debounce timer
  const refreshTimeoutRef = useRef(null);

  // Debounced refresh function
  const debouncedRefresh = useCallback((delay = 500) => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Set new timeout
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/refresh", { method: "POST" });
        console.log("Debounced refresh event dispatched");
      } catch (err) {
        console.error("Error dispatching refresh:", err);
      }
    }, delay);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");

      const data = await response.json();

      // Helper function to safely parse numeric values
      const toNumber = (val, fallback) => {
        if (val == null) return fallback;
        if (typeof val === "string") {
          const num = parseFloat(val.replace(/px$/i, ""));
          return isNaN(num) ? fallback : num;
        }
        return typeof val === "number" ? val : fallback;
      };

      // Update settings with received data
      setSettings({
        // UI Settings
        bgColor:
          data.bgColor ||
          "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)",
        scaleSize: toNumber(data.scaleSize, 1.0),
        maxWidth: toNumber(data.maxWidth, 700),
        padding: toNumber(data.padding, 10),
        fontFamily: data.fontFamily || "Arial, sans-serif",
        fontColor: data.fontColor || "#ffffff",
        textStroke: Boolean(data.textStroke),
        textStrokeSize: toNumber(data.textStrokeSize, 0),
        textStrokeColor: data.textStrokeColor || "rgba(0, 0, 0, 1)",
        playerLocationCoords: {
          x: toNumber(data.playerLocationX, 0),
          y: toNumber(data.playerLocationY, 0),
        },
        playerAlignment: data.playerAlignment || "right",
        scrollSpeed: data.scrollSpeed || 25,
        hideOnNothing: data.hideOnNothing || false,
        //YapMeter Settings
        yapMeterThreshold: toNumber(data.yapMeterThreshold, 1.0),
        yapMeterSilenceThreshold: toNumber(data.yapMeterSilenceThreshold, 3),
        yapMeterMaxYap: toNumber(data.yapMeterMaxYap, 60),
        yapMeterLength: toNumber(data.yapMeterLength, 300),
        // Service Settings
        twitchName: data.twitchName || "",
        lastfmName: data.lastfmName || "",
        emoteSetId: data.emoteSetId || "",

        // Emote Settings
        emoteLifetime: toNumber(data.emoteLifetime, 5000),
        emoteScale: toNumber(data.emoteScale, 1.0),
        emoteDelay: toNumber(data.emoteDelay, 150),
        subEffects: Boolean(data.subEffects),
        raidEffect: Boolean(data.raidEffect),
        subEffectTypes: Array.isArray(data.subEffectTypes)
          ? data.subEffectTypes
          : typeof data.subEffectTypes === "string" &&
            data.subEffectTypes.length > 0
          ? [data.subEffectTypes]
          : [],
        subOnlyMode: Boolean(data.subOnlyMode),
        //HueShift
        subEffectHueShiftChance: toNumber(data.subEffectHueShiftChance, 5),
        //blackhole
        subEffectBlackHoleChance: toNumber(data.subEffectBlackHoleChance, 5),
        subEffectBlackHoleDuration: toNumber(
          data.subEffectBlackHoleDuration,
          5
        ),
        subEffectBlackHoleStrength: toNumber(
          data.subEffectBlackHoleStrength,
          5
        ),
        //reverse gravity
        subEffectReverseGravityChance: toNumber(
          data.subEffectReverseGravityChance,
          5
        ),
        subEffectReverseGravityDuration: toNumber(
          data.subEffectReverseGravityDuration,
          5
        ),
        subEffectReverseGravityStrength: toNumber(
          data.subEffectReverseGravityStrength,
          2
        ),
        subEffectNoGravityChance: toNumber(data.subEffectNoGravityChance, 5),
        subEffectNoGravityDuration: toNumber(
          data.subEffectNoGravityDuration,
          5
        ),
        // Battle Event settings
        battleEventChance: toNumber(data.battleEventChance, 5),
        battleEventParticipants: toNumber(data.battleEventParticipants, 8),
        battleEventHp: toNumber(data.battleEventHp, 300),
        battleEventDamage: toNumber(data.battleEventDamage, 50),
        battleEventDuration: toNumber(data.battleEventDuration, 60),
        battleEventDPSTracker: Boolean(data.battleEventDPSTracker),
        battleEventDPSTrackerLive: Boolean(data.battleEventDPSTrackerLive),
        battleEventAcceptPlebs: Boolean(data.battleEventAcceptPlebs),
        battleEventDPSTrackerFloatLeft: Boolean(
          data.battleEventDPSTrackerFloatLeft
        ),
        battleEventShowSkillHistory: Boolean(data.battleEventShowSkillHistory),
      });

      setError(null);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available sub effects
  const fetchSubEffectTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/subeffecttypes");
      if (!response.ok) throw new Error("Failed to fetch sub effect types");

      const data = await response.json();
      if (Array.isArray(data)) {
        setAvailableSubEffects(data);
      }
    } catch (err) {
      console.error("Error fetching sub effect types:", err);
    }
  }, []);

  // Fetch version information
  const fetchVersionInfo = useCallback(async () => {
    try {
      // Get current version
      const currentVersionRes = await fetch("/api/currentversion");
      if (currentVersionRes.ok) {
        const currentData = await currentVersionRes.json();
        if (currentData.version) setVersion(currentData.version);
      }

      // Get latest version
      const latestVersionRes = await fetch("/api/latestversion");
      if (latestVersionRes.ok) {
        const latestData = await latestVersionRes.json();
        if (latestData.version) setLatestVersion(latestData.version);
      }
    } catch (err) {
      console.error("Error fetching version info:", err);
    }
  }, []);

  // Function to update local state only (for immediate visual feedback)
  const setLocalSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };

      // Special handling for player location coordinates
      if (key === "playerLocationX" || key === "playerLocationY") {
        newSettings.playerLocationCoords = {
          x: key === "playerLocationX" ? value : prev.playerLocationCoords.x,
          y: key === "playerLocationY" ? value : prev.playerLocationCoords.y,
        };
      }

      return newSettings;
    });
  }, []);

  // Update a single setting
  const updateSetting = useCallback(
    async (key, value) => {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) throw new Error(`Failed to update ${key}`);

        // Update local state immediately
        setSettings((prev) => ({ ...prev, [key]: value }));

        // Debounce the refresh call
        debouncedRefresh();

        return true;
      } catch (err) {
        console.error(`Error updating setting ${key}:`, err);
        return false;
      }
    },
    [debouncedRefresh]
  );

  // Bulk update multiple settings at once
  const updateSettings = useCallback(
    async (updatedSettings) => {
      try {
        console.log("updateSettings called with:", updatedSettings);

        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedSettings),
        });

        if (!response.ok) throw new Error("Failed to update settings");

        console.log("API call successful");

        // Update local state immediately
        setSettings((prev) => {
          const newSettings = { ...prev, ...updatedSettings };

          // Special handling for player location coordinates
          if (
            "playerLocationX" in updatedSettings ||
            "playerLocationY" in updatedSettings
          ) {
            newSettings.playerLocationCoords = {
              x: updatedSettings.playerLocationX ?? prev.playerLocationCoords.x,
              y: updatedSettings.playerLocationY ?? prev.playerLocationCoords.y,
            };
            console.log(
              "Updated playerLocationCoords:",
              newSettings.playerLocationCoords
            );
          }

          return newSettings;
        });

        // Debounce the refresh call
        debouncedRefresh();

        return true;
      } catch (err) {
        console.error("Error updating settings:", err);
        return false;
      }
    },
    [debouncedRefresh]
  );

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
    // Expose the debounced refresh function in case you need manual control
    debouncedRefresh,
    // Function for immediate local state updates without API calls
    setLocalSetting,
  };
}
