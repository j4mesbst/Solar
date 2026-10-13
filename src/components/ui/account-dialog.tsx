import { ArrowRight, Eye, EyeOff, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "./button";
import { Input } from "./input";
import { authClient, authSetupMessage } from "../../services/auth";

type AccountMode = "login" | "signup" | "reset" | "update";

export function AccountDialog({ open, onClose, embedded = false }: { open: boolean; onClose: () => void; embedded?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<AccountMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (embedded) {
      void authClient?.auth.getUser().then(({ data }) => setUser(data.user));
      return;
    }
    if (open) {
      ref.current?.showModal();
      void authClient?.auth.getUser().then(({ data }) => setUser(data.user));
    } else ref.current?.close();
  }, [open, embedded]);

  useEffect(() => {
    if (sessionStorage.getItem("solar.auth.recovery") === "true") setMode("update");
    const subscription = authClient?.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    if (!authClient) { setError(authSetupMessage); return; }
    if ((mode === "signup" || mode === "update") && password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await authClient.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setNotice("Vérifie tes e-mails pour confirmer ton compte, puis connecte-toi dans Solar.");
      } else if (mode === "reset") {
        const { error } = await authClient.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setNotice("Si ce compte existe, un lien de réinitialisation a été envoyé.");
      } else if (mode === "update") {
        const { error } = await authClient.auth.updateUser({ password });
        if (error) throw error;
        setNotice("Mot de passe modifié."); sessionStorage.removeItem("solar.auth.recovery"); setMode("login");
      } else {
        const { error } = await authClient.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onClose();
      }
      setPassword(""); setConfirm("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Connexion impossible.";
      setError(/Invalid login credentials/i.test(message) ? "Adresse e-mail ou mot de passe incorrect." : /Email not confirmed/i.test(message) ? "Confirme ton adresse e-mail avant de te connecter." : /rate limit/i.test(message) ? "Trop de tentatives. Réessaie un peu plus tard." : message);
    } finally { setBusy(false); }
  };

  const title = user && mode !== "update" ? "Ton compte Solar" : mode === "signup" ? "Créer ton compte Solar" : mode === "reset" ? "Retrouver ton compte" : mode === "update" ? "Nouveau mot de passe" : "Se connecter à Solar";
  const content = <>
    <div className="account-intro"><h2 id="account-heading">{title}</h2><p>Un compte pour retrouver ton identité Solar. Tes conversations, ton dossier de chat et tes clés restent conservés localement.</p></div>
    {user && mode !== "update" ? <div className="account-signed-in"><p className="account-email">{user.email}</p><Button variant="outline" className="small-button" onClick={() => void authClient?.auth.signOut().then(({ error: signOutError }) => { if (signOutError) setError(signOutError.message); })}>Se déconnecter</Button></div> : <form onSubmit={event => void submit(event)}>
      {!authClient && <p className="settings-note" role="status">{authSetupMessage}</p>}
      {mode !== "update" && <label>Adresse e-mail<Input autoFocus={!embedded} required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label>}
      {mode !== "reset" && <label>Mot de passe<Input required minLength={mode === "login" ? 1 : 12} type={visiblePassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)}/></label>}
      {(mode === "signup" || mode === "update") && <label>Confirmer le mot de passe<Input required type={visiblePassword ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)}/></label>}
      {mode !== "reset" && <div className="account-password-tools"><small>{mode === "signup" || mode === "update" ? "12 caractères minimum." : ""}</small><button type="button" aria-label={visiblePassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={visiblePassword} onClick={() => setVisiblePassword(!visiblePassword)}>{visiblePassword ? <EyeOff size={15}/> : <Eye size={15}/>}<span>{visiblePassword ? "Masquer" : "Afficher"}</span></button></div>}
      <div className="dialog-actions"><Button className="account-submit" type="submit" disabled={busy || !authClient}>{busy ? "Connexion…" : mode === "signup" ? "Créer le compte" : mode === "reset" ? "Envoyer le lien" : mode === "update" ? "Enregistrer" : "Se connecter"}<ArrowRight size={17}/></Button></div>
      <div className="account-links"><Button type="button" variant="ghost" disabled={busy} onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}>{mode === "signup" ? "J’ai déjà un compte" : "Créer un compte"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setMode("reset"); setError(""); setNotice(""); }}>Mot de passe oublié</Button></div>
    </form>}
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="account-notice">{notice}</p>}
    <div className="account-footnote"><LockKeyhole size={14}/><span>Session protégée. Les données personnelles restent sur cet appareil.</span></div>
  </>;

  return embedded ? <section className="account-dialog account-page" aria-labelledby="account-heading">{content}</section> : <dialog ref={ref} className="extension-dialog account-dialog" aria-labelledby="account-heading" onCancel={onClose} onClose={onClose}><div className="account-top"><span className="account-wordmark">Solar</span><Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}><X size={18}/></Button></div>{content}</dialog>;
}
