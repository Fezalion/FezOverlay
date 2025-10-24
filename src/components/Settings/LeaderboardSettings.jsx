import { useEffect, useState } from "react";

export default function LeaderboardSettings() {
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchTop = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const json = await res.json();
        if (mounted) setTop(json);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTop();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>

      {loading ? (
        <div>Loading...</div>
      ) : top.length === 0 ? (
        <div>No entries yet</div>
      ) : (
        <div className="space-y-2">
          {top.map((entry, i) => (
            <div
              key={entry.username}
              className="flex justify-between items-center bg-gray-800 p-3 rounded"
            >
              <div className="font-semibold">
                {i + 1}. {entry.username}
              </div>
              <div className="text-blue-400 font-bold">{entry.wins} wins</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
