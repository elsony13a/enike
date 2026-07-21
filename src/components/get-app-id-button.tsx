import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function GetAppIdButton({ size = "lg" }: { size?: "lg" | "default" }) {
  const navigate = useNavigate();
  const [appId, setAppId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (active) setChecking(false);
        return;
      }
      const { data } = await supabase
        .from("publishers")
        .select("app_id")
        .maybeSingle();
      if (active) {
        setAppId(data?.app_id ?? null);
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleClick = async () => {
    if (checking) return;
    if (!appId) {
      navigate({ to: "/auth", search: { mode: "register" } });
      return;
    }
    await navigator.clipboard.writeText(appId);
    setCopied(true);
    toast.success(`App ID copied: ${appId}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={checking}
      className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 hover:opacity-90"
    >
      {appId ? (
        <>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          <span className="font-mono">{appId}</span>
        </>
      ) : (
        <>
          Get your app_id
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}