import { useRef, useEffect } from 'react';

export function useSubscriberTracker(client, enableMock = false) {
  const recentSubscribersRef = useRef([]);
  const maxSubscribers = 50; // Keep track of last 50 subs

  // Optional: Add mock data for testing
  useEffect(() => {
    if (enableMock) {
      recentSubscribersRef.current = Array.from({ length: 5 }, (_, i) => ({
        name: `TestUser${i + 1}`,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
        username: `testuser${i + 1}`,
        timestamp: Date.now() - i * 1000 * 60,
        badges: { subscriber: '1' },
        isMod: false,
        isVip: false,
        isBroadcaster: i === 0 // make first mock broadcaster
      }));
    }
  }, [enableMock]);

  useEffect(() => {
    if (!client) return;

    function onMessage(channel, userstate, message) {
      const isSub =
        userstate.subscriber ||
        userstate.mod ||
        userstate.badges?.vip ||
        userstate.badges?.broadcaster;

      if (isSub && userstate['display-name']) {
        const subscriber = {
          name: userstate['display-name'],
          color: userstate.color || '#ff6600',
          username: userstate.username,
          timestamp: Date.now(),
          badges: userstate.badges || {},
          isMod: userstate.mod,
          isVip: userstate.badges?.vip,
          isBroadcaster: userstate.badges?.broadcaster
        };

        // Add/update subscriber in list
        const existingIndex = recentSubscribersRef.current.findIndex(
          sub => sub.username === subscriber.username
        );

        if (existingIndex !== -1) {
          recentSubscribersRef.current[existingIndex] = subscriber;
        } else {
          recentSubscribersRef.current.unshift(subscriber);
          if (recentSubscribersRef.current.length > maxSubscribers) {
            recentSubscribersRef.current = recentSubscribersRef.current.slice(0, maxSubscribers);
          }
        }
      }
    }

    client.on('message', onMessage);
    return () => {
      client.off('message', onMessage);
    };
  }, [client, maxSubscribers]);

  const getRandomSubscribers = (count) => {
    const available = [...recentSubscribersRef.current];
    const selected = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available.splice(randomIndex, 1)[0]);
    }

    return selected;
  };

  const getSubscriberCount = () => recentSubscribersRef.current.length;

  return {
    recentSubscribers: recentSubscribersRef.current,
    getRandomSubscribers,
    getSubscriberCount
  };
}
