import { useState, useEffect, useCallback, useRef } from "react";

export function useMetadata() {
  // Settings state
  const [settings, setSettings] = useState({
    // UI Settings
    bgColor: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)",
    scaleSize: 2.0,
    fontFamily: "Arial, sans-serif",
    fontColor: "#ffffff",
    textStroke: false,
    textStrokeSize: 0,
    textStrokeColor: "rgba(0, 0, 0, 1)",
    playerAlignment: "right",
    scrollSpeed: 25,
    hideOnNothing: false,

    //ChatOverlay Settings
    chatLocationCoords: { x: 0, y: 0 },
    chatBackgroundColor: "rgba(0, 0, 0, 0)",
    chatFontColor: "#ffffff",
    maxChatMessages: 10,
    chatFadeDuration: 10000,
    chatFadeTransition: 2000,
    chatAlignment: "left",
    chatEditMode: false,
    chatWidth: 800,
    chatHeight: 300,
    chatFontSize: 14,
    chatFontBold: false,

    //ChatOverlay Effects
    chatEffectRainbowText: false,
    chatEffectRainbowTextChance: 10,

    chatEffectJumpingText: false,
    chatEffectJumpingTextChance: 10,

    chatEffectScatterText: false,
    chatEffectScatterTextChance: 10,

    //YapMeter Settings
    yapMeterThreshold: 1.0,
    yapMeterSilenceThreshold: 3,
    yapMeterMaxYap: 60,
    yapMeterLength: 300,
    yapMeterBlabberingEmote: "BLABBERING",
    yapMeterYappingEmote: "yapping",

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
    emoteStaticMode: false,
    enableBTTV: true,
    enableFFZ: true,
    includeTwitchChannelEmotes: true,
    //HueShift
    subEffectHueShiftChance: 5,
    // Blackhole settings
    subEffectBlackHoleChance: 5,
    subEffectBlackHoleStrength: 5,
    subEffectBlackHoleDuration: 15,
    //Reverse Gravity settings
    subEffectReverseGravityChance: 5,
    subEffectReverseGravityStrength: 2,
    subEffectReverseGravityDuration: 15,
    //Gravity event settings
    subEffectGravityEventChance: 5,
    subEffectGravityEventDuration: 15,
    subEffectGravityEventStrength: 1,
    // Battle Event settings
    battleEventChance: 5,
    battleEventParticipants: 8,
    battleEventHp: 300,
    battleEventDamage: 50,
    battleEventDuration: 60,
    battleEventDPSTracker: true,
    battleEventDPSTrackerLive: true,
    battleEventDPSTrackerLiveFloatLeft: false,
    battleEventDPSTrackerFloatLeft: false,
    battleEventLeaderboardFloatLeft: false,
    battleEventAcceptPlebs: false,
    battleEventShowSkillHistory: true,
    //POE Death Counter settings
    deathCounterBackground: "rgba(0,0,0,0)",
    deathCounterColor: "#ffffff",
    deathCounterShadowColor: "#ff0000",
    deathCounterShadow: true,
    deathCounterEmotes: ["KEKW"],
    deathCounterEmotesPerDeath: 10,
    deathCounterPrefix: "Deaths:",
    deathCounterCharName: "",
    //Redeem
    redeemFeed: "",
    redeemSongRequest: "",

    // Music Settings
    maxSongLength: 0, // 0 = unlimited, otherwise max duration in seconds
  });

  const [availableSubEffects, setAvailableSubEffects] = useState([]);
  const [version, setVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track pending (unsaved) changes using state for reactivity
  const pendingChangesRef = useRef({});
  const [unsavedCount, setUnsavedCount] = useState(0);

  const hasUnsavedChanges = unsavedCount > 0;

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

  // Clear pending helper
  const clearPending = useCallback(() => {
    pendingChangesRef.current = {};
    setUnsavedCount(0);
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
        scaleSize: toNumber(data.scaleSize, 2.0),
        fontFamily: data.fontFamily || "Arial, sans-serif",
        fontColor: data.fontColor || "#ffffff",
        textStroke: Boolean(data.textStroke),
        textStrokeSize: toNumber(data.textStrokeSize, 0),
        textStrokeColor: data.textStrokeColor || "rgba(0, 0, 0, 1)",
        playerAlignment: data.playerAlignment || "right",
        scrollSpeed: data.scrollSpeed || 25,
        hideOnNothing: data.hideOnNothing || false,
        //ChatOverlay Settings
        chatLocationCoords: {
          x: toNumber(data.chatLocationX, 0),
          y: toNumber(data.chatLocationY, 0),
        },
        chatBackgroundColor: data.chatBackgroundColor || "rgba(0, 0, 0, 0)",
        chatFontColor: data.chatFontColor || "#ffffff",
        maxChatMessages: toNumber(data.maxChatMessages, 10),
        chatFadeDuration: toNumber(data.chatFadeDuration, 10000),
        chatFadeTransition: toNumber(data.chatFadeTransition, 2000),
        chatAlignment: data.chatAlignment || "left",
        chatEditMode: Boolean(data.chatEditMode),
        chatWidth: toNumber(data.chatWidth, 800),
        chatHeight: toNumber(data.chatHeight, 300),
        chatFontSize: toNumber(data.chatFontSize, 14),
        chatFontBold: Boolean(data.chatFontBold) || false,

        //ChatOverlay Effects
        chatEffectRainbowText: Boolean(data.chatEffectRainbowText) || false,
        chatEffectRainbowTextChance: toNumber(
          data.chatEffectRainbowTextChance,
          10,
        ),

        chatEffectJumpingText: Boolean(data.chatEffectJumpingText) || false,
        chatEffectJumpingTextChance: toNumber(
          data.chatEffectJumpingTextChance,
          10,
        ),

        chatEffectScatterText: Boolean(data.chatEffectScatterText) || false,
        chatEffectScatterTextChance: toNumber(
          data.chatEffectScatterTextChance,
          10,
        ),

        //YapMeter Settings
        yapMeterThreshold: toNumber(data.yapMeterThreshold, 1.0),
        yapMeterSilenceThreshold: toNumber(data.yapMeterSilenceThreshold, 3),
        yapMeterMaxYap: toNumber(data.yapMeterMaxYap, 60),
        yapMeterLength: toNumber(data.yapMeterLength, 300),
        yapMeterBlabberingEmote: data.yapMeterBlabberingEmote || "BLABBERING",
        yapMeterYappingEmote: data.yapMeterYappingEmote || "yapping",

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
        emoteStaticMode: Boolean(data.emoteStaticMode),
        enableBTTV: Boolean(data.enableBTTV || true),
        enableFFZ: Boolean(data.enableFFZ || true),
        includeTwitchChannelEmotes: Boolean(
          data.includeTwitchChannelEmotes || true,
        ),
        //HueShift
        subEffectHueShiftChance: toNumber(data.subEffectHueShiftChance, 5),
        //blackhole
        subEffectBlackHoleChance: toNumber(data.subEffectBlackHoleChance, 5),
        subEffectBlackHoleDuration: toNumber(
          data.subEffectBlackHoleDuration,
          15,
        ),
        subEffectBlackHoleStrength: toNumber(
          data.subEffectBlackHoleStrength,
          5,
        ),
        //reverse gravity
        subEffectReverseGravityChance: toNumber(
          data.subEffectReverseGravityChance,
          5,
        ),
        subEffectReverseGravityDuration: toNumber(
          data.subEffectReverseGravityDuration,
          15,
        ),
        subEffectReverseGravityStrength: toNumber(
          data.subEffectReverseGravityStrength,
          2,
        ),
        subEffectGravityEventChance: toNumber(
          data.subEffectGravityEventChance,
          5,
        ),
        subEffectGravityEventDuration: toNumber(
          data.subEffectGravityEventDuration,
          15,
        ),
        subEffectGravityEventStrength: toNumber(
          data.subEffectGravityEventStrength,
          1,
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
          data.battleEventDPSTrackerFloatLeft,
        ),
        battleEventLeaderboardFloatLeft: Boolean(
          data.battleEventLeaderboardFloatLeft,
        ),
        battleEventDPSTrackerLiveFloatLeft: Boolean(
          data.battleEventDPSTrackerLiveFloatLeft,
        ),
        battleEventShowSkillHistory: Boolean(data.battleEventShowSkillHistory),
        //Death Counter
        deathCounterBackground:
          data.deathCounterBackground || "rgba(0, 0, 0, 0)",
        deathCounterColor: data.deathCounterColor || "#ffffff",
        deathCounterShadowColor: data.deathCounterShadowColor || "#ff0000",
        deathCounterShadow: Boolean(data.deathCounterShadow),
        deathCounterEmotes: Array.isArray(data.deathCounterEmotes)
          ? data.deathCounterEmotes
          : typeof data.deathCounterEmotes === "string" &&
              data.deathCounterEmotes.length > 0
            ? [data.deathCounterEmotes]
            : ["KEKW"],
        deathCounterEmotesPerDeath: toNumber(
          data.deathCounterEmotesPerDeath,
          10,
        ),
        deathCounterPrefix: data.deathCounterPrefix || "Deaths:",
        deathCounterCharName: data.deathCounterCharName || "",

        //
        redeemFeed: data.redeemFeed || "",
        redeemSongRequest: data.redeemSongRequest || "",

        // Music Settings
        maxSongLength: toNumber(data.maxSongLength, 0),
      });

      // Clear pending changes after successful fetch
      clearPending();

      setError(null);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [clearPending]);

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

  // Update a single setting locally (no API call, tracks as pending)
  const updateSetting = useCallback((key, value) => {
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

    // Track the change as pending and update count for reactivity
    pendingChangesRef.current[key] = value;
    setUnsavedCount(Object.keys(pendingChangesRef.current).length);
  }, []);

  // Save all pending changes to the backend
  const saveSettings = useCallback(async () => {
    const changes = { ...pendingChangesRef.current };
    if (Object.keys(changes).length === 0) return true;

    setIsSaving(true);
    try {
      console.log("Saving settings:", changes);

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      console.log("Settings saved successfully");

      // Clear pending changes
      clearPending();

      // Debounce the refresh call
      debouncedRefresh();

      return true;
    } catch (err) {
      console.error("Error saving settings:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [debouncedRefresh, clearPending]);

  // Discard pending changes (revert to last saved state)
  const discardSettings = useCallback(() => {
    clearPending();
    fetchSettings();
  }, [clearPending, fetchSettings]);

  // Load all data on initial mount
  useEffect(() => {
    const loadAllData = async () => {
      await fetchSettings();
      await fetchSubEffectTypes();
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
    isSaving,
    hasUnsavedChanges,
    updateSetting,
    saveSettings,
    discardSettings,
    refreshSettings: fetchSettings,
  };
}
