import { useEffect, useState, useRef } from 'react';

const poll_rate = 1000; // 1 second
let LASTFM_USERNAME = 'your_lastfm_username'; // Replace with your Last.fm username
const MOVE_AMOUNT = 1;

export function NowPlaying() {
  const [latestTrack, setLatestTrack] = useState(null);
  const [position, setPosition] = useState({x:0, y:0});
  const marqueeRef = useRef();
  const containerWidthRef = useRef(0);

  useEffect(() => {
    fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            if (data.lastfmName && data.lastfmName.length > 0) {
                LASTFM_USERNAME = data.lastfmName;
            } else {
              console.warn("No Last.fm username set in settings, using default.");
            }
            if (data.playerLocationX !== undefined && data.playerLocationY !== undefined) {
              setPosition({ x: data.playerLocationX, y: data.playerLocationY });
              updateCSSVars(data.playerLocationX, data.playerLocationY);
            }
        })
        .catch(err => console.error("Failed to fetch lastfm settings:", err));

    const fetchLatestTrack = () => {
      fetch(`/api/lastfm/latest/${LASTFM_USERNAME}`)
        .then(response => response.json())
        .then(response => {
          if (!response || response.error) {
            setLatestTrack(null);
            return;
          }
          const newTrack = {
            name: response.track.name,
            artist: response.track.artist
          };          
          setLatestTrack(newTrack);
          if (latestTrack && latestTrack.name !== newTrack.name && latestTrack.artist !== newTrack.artist) {
            console.log(`Track changed: ${latestTrack.name} by ${latestTrack.artist} to ${newTrack.name} by ${newTrack.artist}`);            
            marqueeRef.current.children[0].style.animationPlayState = 'paused';
          }
        })
        .catch(() => setLatestTrack(null));
    };

    fetchLatestTrack();
    const interval = setInterval(fetchLatestTrack, poll_rate);
    return () => clearInterval(interval);
  }, [latestTrack]);

    useEffect(() => {
    const handleKeyDown = (e) => {
      let { x, y } = position;
      const moveBy = e.shiftKey ? MOVE_AMOUNT * 5 : MOVE_AMOUNT; // Shift = move faster

      switch (e.key) {
        case 'ArrowUp':
          y -= moveBy;
          break;
        case 'ArrowDown':
          y += moveBy;
          break;
        case 'ArrowLeft':
          x -= moveBy;
          break;
        case 'ArrowRight':
          x += moveBy;
          break;
        case 'Space':
          // Reset position
          x = 0;
          y = 0;
          break;
        default:
          return;
      }

      e.preventDefault();
      setPosition({ x, y });
      updateCSSVars(x, y);
      updateSetting('playerLocationX', x);
      updateSetting('playerLocationY', y);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position]);

      const updateCSSVars = (x, y) => {
        document.documentElement.style.setProperty('--overlay-x', `${x}px`);
        document.documentElement.style.setProperty('--overlay-y', `${y}px`);
      };

    const updateSetting = (key, value) => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
    };

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect.width !== containerWidthRef.current) {
          const containerWidth = marqueeRef.current.clientWidth;
          const textWidth = marqueeRef.current.scrollWidth;
          const children = marqueeRef.current.children[0];
          console.log(`children: ${children}`);
          console.log(`Container width: ${containerWidth}, Text width: ${textWidth}`);

          if (textWidth > 473 && textWidth > containerWidth) {
            children.style.animationPlayState = 'running';
            containerWidthRef.current = containerWidth;
          } else {
            children.style.animationPlayState = 'paused';
          }
        }
      }
    });

    observer.observe(marqueeRef.current);

    return () => observer.unobserve(marqueeRef.current);
  }, [latestTrack]);

  return (
    <span className="songPanel" ref={marqueeRef}  key={latestTrack ? latestTrack.name + latestTrack.artist : 'no-track'}>
      <span              
        className={`marquee`}
        style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
      >
        {latestTrack ? `${latestTrack.artist} - ${latestTrack.name}` : 'Nothing is playing...'}
      </span>
    </span>
  );
}