"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Ships nothing until it's needed: a member-only support chat chunk is fetched
// only when a Supabase auth cookie is present, so public pages pay no cost.
const ChatWidget = dynamic(() => import("./chat-widget"), { ssr: false });

export function ChatDock() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(/(?:^|;\s*)sb-[\w-]+-auth-token=/.test(document.cookie));
  }, []);

  if (!signedIn || pathname.startsWith("/admin")) return null;
  return <ChatWidget />;
}
