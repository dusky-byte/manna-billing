"use client";
import { useEffect, useState } from "react";

export default function TitleBar() {
  const [online, setOnline] = useState(true);
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setOnline(navigator.onLine);
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 20000);
    window.addEventListener("online", tick);
    window.addEventListener("offline", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", tick);
      window.removeEventListener("offline", tick);
    };
  }, []);

  return (
    <div className="title noprint">
      <span>BILLING SYSTEM</span>
      <span><i className={"lamp" + (online ? "" : " off")} />{online ? "Online" : "Offline"} · {time}</span>
    </div>
  );
}
