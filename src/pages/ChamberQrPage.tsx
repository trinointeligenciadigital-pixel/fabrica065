import QRCode from "qrcode";
import { useQuery } from "convex/react";
import { ArrowLeft, Copy, Printer, QrCode, Snowflake } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";

interface ChamberQrPageProps {
  integrationsReady: boolean;
}

function ConnectedQr() {
  const { chamberId } = useParams();
  const id = chamberId as Id<"chambers"> | undefined;
  const chamber = useQuery(api.catalog.getChamber, id ? { id } : "skip");
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);
  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
  const operationUrl = chamber ? publicAppUrl + "/operacao/" + chamber.publicToken : "";

  useEffect(() => {
    if (!operationUrl) return;
    let active = true;
    void QRCode.toDataURL(operationUrl, { width: 560, margin: 2, errorCorrectionLevel: "H", color: { dark: "#12262c", light: "#ffffff" } })
      .then((result) => {
        if (active) setQrData(result);
      });
    return () => { active = false; };
  }, [operationUrl]);

  if (chamber === undefined) {
    return <div className="content-section table-loading"><span className="skeleton-line skeleton-wide" /><span className="skeleton-line" /></div>;
  }

  async function copyLink() {
    await navigator.clipboard.writeText(operationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className="qr-page-actions no-print">
        <Link className="back-button" to="/cadastros/camaras"><ArrowLeft size={17} />Voltar para câmaras</Link>
        <div><button className="button button-secondary" onClick={() => void copyLink()}><Copy size={17} />{copied ? "Link copiado" : "Copiar link"}</button><button className="button button-primary" onClick={() => window.print()}><Printer size={17} />Imprimir QR</button></div>
      </div>
      <section className="qr-print-sheet">
        <div className="qr-print-brand"><span><Snowflake size={24} /></span><div><strong>Estoque 065</strong><small>Registro operacional</small></div></div>
        <div className="qr-print-copy"><p>Acesso da câmara</p><h1>{chamber.name}</h1><span>Escaneie o código com a câmera do celular e informe seu PIN individual.</span></div>
        <div className="qr-code-frame">{qrData ? <img src={qrData} alt={"QR Code de acesso da " + chamber.name} /> : <span className="loading-spinner" />}</div>
        <div className="qr-print-steps"><span><b>1</b> Escaneie o QR</span><span><b>2</b> Digite seu PIN</span><span><b>3</b> Registre a operação</span></div>
        <p className="qr-url">{operationUrl}</p>
        <p className="qr-security">Este código identifica somente a câmara. O acesso exige PIN autorizado.</p>
      </section>
    </>
  );
}

export function ChamberQrPage({ integrationsReady }: ChamberQrPageProps) {
  return (
    <AdminShell integrationsReady={integrationsReady}>
      {integrationsReady ? <ConnectedQr /> : <div className="setup-notice"><QrCode size={20} /><div><strong>QR indisponível no modo demonstração</strong></div></div>}
    </AdminShell>
  );
}