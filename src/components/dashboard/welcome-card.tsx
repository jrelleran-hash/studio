"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function WelcomeCard() {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">
          Welcome Back, User!
        </h1>
        <p className="text-muted-foreground">{currentDate}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/profile">
          <Button variant="outline">View Profile</Button>
        </Link>
        <Link href="/analytics">
          <Button>View Analytics</Button>
        </Link>
      </div>
    </div>
  );
}
