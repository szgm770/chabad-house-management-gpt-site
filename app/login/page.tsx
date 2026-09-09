import { ShieldCheck } from "lucide-react";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; return_to?: string }> }) {
  const params = await searchParams; const returnTo = params.return_to?.startsWith("/") && !params.return_to.startsWith("//") && !params.return_to.startsWith("/login") ? params.return_to : "/";
  const message = params.error === "not_allowed" ? "החשבון הזה אינו מורשה להיכנס למערכת." : params.error === "oauth" ? "לא הצלחנו להשלים את הכניסה. אפשר לנסות שוב." : "";
  return <main className="login-page"><section className="login-card"><span className="login-mark"><ShieldCheck /></span><h1>מערכת ניהול בית חב״ד</h1><p>הכניסה מיועדת למשתמשים מורשים בלבד.</p>{message && <div className="login-error">{message}</div>}<a className="google-login" href={`/api/auth/google?return_to=${encodeURIComponent(returnTo)}`}>כניסה באמצעות Google</a><small>פרטי התורמים והכספים מוגנים ודורשים חשבון מאושר.</small></section></main>;
}
