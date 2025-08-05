import { useEffect, useState, useRef } from 'react';

const poll_rate = 1000; // 1 seconds

export function NowPlaying() {
  const [latestTrack, setLatestTrack] = useState(null);
  const [animate, setAnimate] = useState(false);
  const prevTrackRef = useRef();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const username = query.get('user');
    if (!username) {
      console.error('No username provided in URL');
      return;
    }

    const fetchLatestTrack = () => {
      fetch(`/api/lastfm/latest/${username}`)
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
          // Trigger animation if track changed
          if (
            !prevTrackRef.current ||
            prevTrackRef.current.name !== newTrack.name ||
            prevTrackRef.current.artist !== newTrack.artist
          ) {
            setAnimate(true);
            setTimeout(() => setAnimate(false), 600); // match animation duration
          }
          prevTrackRef.current = newTrack;
          setLatestTrack(newTrack);
        })
        .catch(() => setLatestTrack(null));
    };

    fetchLatestTrack();
    const interval = setInterval(fetchLatestTrack, poll_rate);
    return () => clearInterval(interval);
  }, []);

  if (!latestTrack) {
    return (
      <span className="songPanel">
        <span className={animate ? 'animate' : ''}>Nothing is playing...</span>
      </span>
    );
  }
  return (
    <span className="songPanel">
      <span className={animate ? 'animate' : ''}>
        {latestTrack.artist} - {latestTrack.name}
      </span>
    </span>
  );
}
