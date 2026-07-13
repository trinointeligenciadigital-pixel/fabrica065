import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={18} aria-hidden="true" />
      Sem conexão. Novos lançamentos estão bloqueados até a internet voltar.
    </div>
  );
}