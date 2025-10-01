
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Camera } from "lucide-react";

interface WelcomeCardProps {
  onScanClick: () => void;
}

export function WelcomeCard({ onScanClick }: WelcomeCardProps) {
  const { user } = useAuth();
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

  const getFirstName = () => {
    if (user?.displayName) {
      const nameParts = user.displayName.split(" ").filter(Boolean);
      if (nameParts.length > 1) {
        nameParts.pop(); // Remove the last part (last name)
        return nameParts.join(" ");
      }
      return user.displayName; // Return the full name if it's just one word
    }
    return user?.email || "User";
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">
          Welcome Back, {getFirstName()}!
        </h1>
        <p className="text-muted-foreground">{currentDate}</p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button variant="outline" className="w-full flex-1 sm:flex-initial" onClick={onScanClick}>
            <Camera className="mr-2 h-4 w-4" />
            Scan Product
        </Button>
        <Link href="/analytics" className="flex-1 sm:flex-initial">
          <Button className="w-full">View Analytics</Button>
        </Link>
      </div>
    </div>
  );
}
