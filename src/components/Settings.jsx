import { useState, useEffect, useRef } from 'react';
import ColorPicker from 'react-best-gradient-color-picker'

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

export function Settings() {
  const pickerRef = useRef(null);
  const OutlinepickerRef = useRef(null);

  const [showPicker, setShowPicker] = useState(false);
  const [showOutlinePicker, setShowOutlinePicker] = useState(false);
  
  const [color, setColor] = useState('linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0,0,0,1) 100%)');

  const [scaleSize, setScaleSize] = useState(1.0);
  const [maxWidth, setMaxWidth] = useState(700);
  const [padding, setPadding] = useState(10);
  
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [fontColor, setFontColor] = useState('#ffffff');
  const [textStroke, setTextStroke] = useState(false);
  const [textStrokeSize, setTextStrokeSize] = useState(0);
  const [textStrokeColor, setTextStrokeColor] = useState('rgba(0, 0, 0, 1)')

  const [_, setPlayerLocationCoords] = useState({ x: 0, y: 0 });


  const [twitchName, setTwitchName] = useState('');
  const [lastfmName, setLastfmName] = useState('');

  const [emoteSetId, setEmoteSetId] = useState('');
  const [emoteLifetime, setEmoteLifetime] = useState(5000);
  const [emoteScale, setEmoteScale] = useState(1.0);
  const [emoteDelay, setEmoteDelay] = useState(150);
  const [subEffects, setSubEffects] = useState(true);
  const [subEffectTypes, setSubEffectTypes] = useState([]);
  const [availableSubEffects, setAvailableSubEffects] = useState([]);
  const [subEffectChance, setSubEffectChance] = useState(0.25);

  const [latestVersion, setLatestVersion] = useState();
  const [version, setVersion] = useState();  

  //set the settings for displaying
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const toNumber = (val, fallback) => {
          if (val == null) return fallback;
          if (typeof val === 'string') {
            const num = parseFloat(val.replace(/px$/i, ''));
            return isNaN(num) ? fallback : num;
          }
          return typeof val === 'number' ? val : fallback;
        };

        setColor(data.bgColor || '#800080');

        // Decimal-safe
        setScaleSize(toNumber(data.scaleSize, 1.0));
        setEmoteScale(toNumber(data.emoteScale, 1.0));

        // Integer-safe with px stripping
        setMaxWidth(toNumber(data.maxWidth, 700));
        setPadding(toNumber(data.padding, 10));
        setEmoteLifetime(toNumber(data.emoteLifetime, 5000));
        setPlayerLocationCoords({
          x: toNumber(data.playerLocationX, 0),
          y: toNumber(data.playerLocationY, 0)
        });
        setTextStrokeSize(toNumber(data.textStrokeSize, 0));
        setEmoteDelay(toNumber(data.emoteDelay, 150));

        setFontFamily(data.fontFamily || 'Arial, sans-serif');
        setFontColor(data.fontColor || '#ffffff');
        setTwitchName(data.twitchName || '');
        setLastfmName(data.lastfmName || '');
        setEmoteSetId(data.emoteSetId || '');
        setTextStroke(Boolean(data.textStroke));
        setTextStrokeColor(data.textStrokeColor || 'rgba(0, 0, 0, 1)');
        setSubEffects(Boolean(data.subEffects));
        setSubEffectChance(toNumber(data.subEffectChance, 0.25));

        setSubEffectTypes(
          Array.isArray(data.subEffectTypes)
            ? data.subEffectTypes
            : typeof data.subEffectTypes === 'string' && data.subEffectTypes.length > 0
              ? [data.subEffectTypes]
              : []
        );

        console.log(availableSubEffects);
      });

      fetch('/api/latestversion')
        .then(res => res.json())
        .then(data => {
          if (data.version) setLatestVersion(data.version);
        }) 
        fetch('/api/subeffecttypes')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setAvailableSubEffects(data);
            }
          });  
  }, []);

  useEffect(() => {
    fetch('/api/currentversion')
        .then(res => res.json())
        .then(data => {
          if(data.version) setVersion(data.version);
        });
  }, [latestVersion]);
  

  const updateSetting = (key, value) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    }).then(() => {
      fetch('/api/refresh', {
        method: 'POST'
      });
      console.log("Refresh Event dispatch");
    });
  };

  const handleScaleSize = (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    setScaleSize(val);
    updateSetting('scaleSize', val);
  };

  const handleMaxWidth = (e) => {
    const val = parseInt(e.target.value) || 700;
    setMaxWidth(val);
    updateSetting('maxWidth', val);
  };

  const handlePadding = (e) => {
    const val = parseInt(e.target.value) || 10;
    setPadding(val);
    updateSetting('padding', val);
  };

  const handleFontFamily = (e) => {
    setFontFamily(e.target.value);
    updateSetting('fontFamily', e.target.value);
  };

  const handleFontColor = (e) => {
    setFontColor(e.target.value);
    updateSetting('fontColor', e.target.value);
  };

  const handleTwitchNameChange = (e) => {
    setTwitchName(e.target.value);
    updateSetting('twitchName', e.target.value);
  };

  const handleLastfmNameChange = (e) => {
    setLastfmName(e.target.value);
    updateSetting('lastfmName', e.target.value);
  };

  const handleEmoteSetIdChange = (e) => {
    setEmoteSetId(e.target.value);
    updateSetting('emoteSetId', e.target.value);
  };

  const handleEmoteLifetimeChange = (e) => {
    const val = parseInt(e.target.value) || 5000;
    setEmoteLifetime(val);
    updateSetting('emoteLifetime', val);
  };

  const handleEmoteScaleChange = (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    setEmoteScale(val);
    updateSetting('emoteScale', val);
  };

  const handleEmoteDelayChange = (e) => {
    const val = parseInt(e.target.value) || 150;
    setEmoteDelay(val);
    updateSetting('emoteDelay', val);
  }

  const handleBgColorChange = (newColor) => {
    setColor(newColor);
    updateSetting('bgColor', newColor);
  };
  
  const handleTextStrokeToggle = (e) => {
    const isChecked = e.target.checked;
    setTextStroke(isChecked);
    updateSetting('textStroke', isChecked);
  }

  const handleTextStrokeColor = (color) => {
    setTextStrokeColor(color);
    updateSetting('textStrokeColor', color);
  }

  const handleTextStrokeSize = (e) => {
    const val = parseInt(e.target.value) || 0;
    setTextStrokeSize(val);
    updateSetting('textStrokeSize', val);
  }

  const handleSubEffectsToggle = (e) => {
    const isChecked = e.target.checked;
    setSubEffects(isChecked);
    updateSetting('subEffects', isChecked);
  }

  const handleSubEffectsChance = (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    setSubEffectChance(val);
    updateSetting('subEffectChance', val);
  }



  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        console.log('Clicked outside the picker, closing it');
        setShowPicker(false);
      }
      if (OutlinepickerRef.current && !OutlinepickerRef.current.contains(event.target)) {
        console.log('Clicked outside the outline picker, closing it');
        setShowOutlinePicker(false);
      }
    }

    if (showPicker || showOutlinePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker, showOutlinePicker]);

  function getStrokeTextShadow(width, color) {
    if (width <= 0) return 'none';
    const shadows = [];

    for (let dx = -width; dx <= width; dx++) {
      for (let dy = -width; dy <= width; dy++) {
        if (dx === 0 && dy === 0) continue;
        shadows.push(`${dx}px ${dy}px 0 ${color}`);
      }
    }

    return shadows.join(', ');
  }

  return (
    <div className='settingsMainContainer'>
      <h1 style={{ textAlign: 'center'}}>Overlay Settings <span className='explanation'>installed {version}</span> {latestVersion !== version && <span className='explanation'> | you can update to <span style={{color:"green"}}>{latestVersion}</span></span>} </h1>     

      <div className='settingsInsideContainer'>
        <div className="settingsContainer">
          <h1>Song Overlay Settings</h1>
          <p className='explanation'>
        You can adjust the position of the overlay in your OBS Browser Source's Interact option, use arrow keys (Shift to go faster)</p>

          {/* Divider */}
          <hr className='divider' />
          {/* Last.fm Username input */}
          <label className='labelH'>
            <span style={{minWidth: 120}}>Lastfm Username</span>
            <input
              type="text"
              value={lastfmName}
              onChange={handleLastfmNameChange}
              placeholder="Enter your Lastfm username"
              style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
            />
          </label>
          {/* Divider */}
          <hr className='divider' />

          {/* Background Gradient Picker Button */}
          <label className='labelV'>
            <h2>Background</h2>

            <button
              type="button"
              onClick={() => {setShowPicker(true);}}              
            >
              Pick Background
            </button>

            {showPicker && (
            <>
              {/* Fullscreen overlay for click outside */}
              <div className='fullscreenBackground'></div> 

              {/* Actual color picker popup */}
              <div
                className="gradient-picker-popup"                              
              >
                <ColorPicker
                  ref={pickerRef}
                  value={color}                  
                  onChange={handleBgColorChange}
                  disableDarkMode={true}
                />
                <div style={{
                  marginTop: 20,
                  padding: `${padding}px`,        
                  fontFamily: fontFamily,
                  color: `rgb(${hexToRgb(fontColor)})`,
                  background: color,
                  zIndex:999,
                  textAlign: 'right',
                  textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor)
                }}>        
                {/* Simulate a track to display in the preview */}
                <span>
                  Example Artist - Example Track
                </span>
              </div>
              </div>
            </>
          )}

          </label>
      {/* Divider */}
      <hr className='divider' />
      
      
      <h2>Font Settings</h2>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Font Color</span>
        <input type="color" value={fontColor} onChange={handleFontColor} style={{width: 36, height: 36, border: 'none', background: 'none'}} />
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Font Family</span>
        <select disabled value={fontFamily} onChange={handleFontFamily} style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Verdana, Geneva, sans-serif">Verdana</option>
          <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
          <option value="Courier New, Courier, monospace">Courier New</option>
          <option value="Times New Roman, Times, serif">Times New Roman</option>
        </select>
        <span className='explanation'>Currently disabled, bugged.</span>
      </label> 

      {/* Divider */}
      <hr className='divider' />

      <h2>Text Outline Settings</h2>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Enable Text Outline</span>
        <input
          type="checkbox"
          checked={textStroke}
          onChange={handleTextStrokeToggle}
          style={{width: 20, height: 20, cursor: 'pointer'}}          
        />
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Text Stroke Size</span>
        <input
          type="number"
          min="0"
          max="50"
          value={textStrokeSize}
          disabled={!textStroke}
          onChange={handleTextStrokeSize}
        />
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Text Outline Color</span>
        <button
          type="button"
          disabled={!textStroke}
          onClick={() => {setShowOutlinePicker(true);}}          
        >
          Pick Outline Color
        </button>

        {showOutlinePicker && (
          <>
            <div className='fullscreenBackground'></div> 
            <div             
              className="gradient-picker-popup"              
            >
              <ColorPicker
                ref={OutlinepickerRef}
                value={textStrokeColor}
                onChange={handleTextStrokeColor}
                hideColorTypeBtns={true}
                hideGradientTypeBtns={true}
                hideControls={true}
                disableDarkMode={true}
              />

              <div style={{
                marginTop: 20,
                padding: `${padding}px`,        
                fontFamily: fontFamily,
                color: `rgb(${hexToRgb(fontColor)})`,
                background: color,
                zIndex:999,
                textAlign: 'right',
                textShadow: getStrokeTextShadow(textStrokeSize, textStrokeColor)
              }}>        
                {/* Simulate a track to display in the preview */}
                <span>
                  Example Artist - Example Track
                </span>
              </div>
            </div>
          </>
        )}
      </label> 

      {/* Divider */}
      <hr className='divider' />

      <h2>Layout Settings</h2>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Scale Size</span>
        <input
          type="number"
          min="0.05"
          max="10.0"
          step="0.05"
          value={scaleSize}
          onChange={handleScaleSize}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter player size scale (default 1.0)"
          ></input>
      </label>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Padding</span>
        <input type="number" min="0" max="50" value={padding} onChange={handlePadding} style={{width: 60}} /> px
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Max Width</span>
        <input
          type="number"
          min="100"
          max="4000"
          value={maxWidth}
          onChange={handleMaxWidth}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter max width in px (default 700)"
          ></input>
      </label>
      
      {/* Divider */}
      <hr className='divider' />   
    </div>

    <div className='settingsContainer'>
      <h1>Emote Overlay Settings</h1>
      <p className='explanation'>
        The emote overlay displays 7TV emotes in real-time as they are used in chat.
        You can customize the appearance of the emotes and their behavior.</p>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Twitch Username</span>
        <input
          type="text"
          value={twitchName}
          onChange={handleTwitchNameChange}
          placeholder="Enter your Twitch username"
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>            
          </input>
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>7tv Emote set ID</span>
        <input
          type="text"
          value={emoteSetId}
          onChange={handleEmoteSetIdChange}
          placeholder="Enter 7vtv emote set ID"
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}>            
          </input>
      </label>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Emote Lifetime</span>        
        <input
          type="number"
          min="500"
          max="20000"
          value={emoteLifetime}
          onChange={handleEmoteLifetimeChange}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter emote lifetime in ms (default 5000)"
          ></input>
      </label>
      <span className='explanation'>Duration for which emotes are displayed (in ms)[Limited to 500-20000ms][Default: 5000]</span>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Emote Scale</span>
        <input
          type="number"
          min="0.1"
          max="5.0"
          step="0.1"
          value={emoteScale}
          onChange={handleEmoteScaleChange}
          style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
          placeholder="Enter emote scale (default 1.0)"
          ></input>
      </label>
      <span className='explanation'>Scale of emotes when displayed [Limited to 0.1-5.0][Default: 1.0]</span>

      <label className='labelH'>
        <span style={{minWidth: 120}}>Emote Delay</span>
        <input
        type='number'
        min="0"
        max="5000"
        step="1"
        value={emoteDelay}
        onChange={handleEmoteDelayChange}
        style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
        placeholder='Enter the emote delay (default 150)'
        ></input>
      </label>
      <span className='explanation'>Delay of emotes spawning from the same message (in ms)[Limited to 0-5000][Default: 150]</span>
      <label className='labelH'>
        <span style={{minWidth: 120}}>Enable Sub Effects</span>
        <input
          type="checkbox"
          checked={subEffects}
          onChange={handleSubEffectsToggle}
          style={{width: 20, height: 20, cursor: 'pointer'}}          
        />
      </label>
      <span className='explanation'>Enable/Disable special effects for subscribers.</span>
      <label className='labelV' style={{alignItems: 'flex-start'}}>
      <span style={{ minWidth: 120, marginBottom: 8 }}>Subscriber Effects</span>
      <div style={{
        flex: 1,
        borderRadius: 6,
        border: '1px solid #ccc',
        padding: 8,
        maxHeight: '100px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        opacity: subEffects ? 1 : 0.5,
        pointerEvents: subEffects ? 'auto' : 'none'
      }}>
        {availableSubEffects.map(effect => {
          const checked = subEffectTypes.includes(effect);
          return (
            <label key={effect} style={{ userSelect: 'none', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={!subEffects}
                checked={checked}
                onChange={() => {
                  let newSelected;
                  if (checked) {
                    newSelected = subEffectTypes.filter(e => e !== effect);
                  } else {
                    newSelected = [...subEffectTypes, effect];
                  }
                  setSubEffectTypes(newSelected);
                  updateSetting('subEffectTypes', newSelected);
                }}
                style={{ marginRight: 8 }}
              />
              {effect.charAt(0).toUpperCase() + effect.slice(1)}
            </label>
          );
        })}
      </div>
    </label>
    <span className='explanation'>
      Select which subscriber effects you want to enable.
    </span>
    <label className='labelH'>
        <span style={{minWidth: 120}}>Sub Effect proc chance</span>
        <input
        type='number'
        min="0.0"
        max="1.0"
        step="0.05"
        value={subEffectChance}
        onChange={handleSubEffectsChance}
        style={{flex: 1, padding: 4, borderRadius: 6, border: '1px solid #ccc'}}
        ></input>
      </label>
        <span className='explanation'>
          Chance of special effects proccing [Limited to 0.0-1.0][Default: 0.25]
        </span>
    </div>
    </div>
    </div>
  );
}
