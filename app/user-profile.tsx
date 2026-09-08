"use client";

import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type User = { displayName: string; email: string };

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => setUser(result?.user || null))
      .catch(() => setUser(null));
  }, []);
  const name = user?.displayName || "משתמש מחובר";
  const initials = name.includes("@")
    ? name.slice(0, 2).toUpperCase()
    : name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("");
  return (
    <div className="signed-user">
      <span className="user-avatar">{initials || <UserRound />}</span>
      <div className="user-identity">
        <b>{name}</b>
        <small>{user?.email || "חשבון מאומת"}</small>
      </div>
      <a
        href="/api/auth/signout"
        target="_top"
        aria-label="יציאה מהמערכת"
        title="יציאה מהמערכת"
      >
        <LogOut />
      </a>
    </div>
  );
}
