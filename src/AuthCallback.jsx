import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const token = hash.get("access_token");

    if (token) {
      fetch("/auth/twitch/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      })
        .then((res) => res.json())
        .then(() => {
          // small delay so user sees the success flash
          setTimeout(() => navigate("/"), 1500);
        })
        .catch(() => {
          document.body.innerText = "❌ Failed to save token.";
        });
    } else {
      document.body.innerText = "❌ No access_token found in URL.";
    }
  }, [navigate]);

  return <p>Authorizing Twitch…</p>;
}
