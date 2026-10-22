
import { ArrowRight, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import "./LoginPage.css";

interface LoginPageProps {
  onGoogleLogin: () => void;
}

export default function LoginPage({ onGoogleLogin }: LoginPageProps) {
  return (
    <main className="space-login">
      <div className="space-stars" aria-hidden="true" />
      <div className="space-nebula space-nebula-one" aria-hidden="true" />
      <div className="space-nebula space-nebula-two" aria-hidden="true" />

      <header className="space-nav">
        <a className="space-brand" href="/" aria-label="ReachInbox home">
          <span className="space-brand-icon">
            <Orbit size={23} />
          </span>
          <span>ReachInbox</span>
        </a>
        <span className="space-nav-label">YOUR EMAILS, IN ORBIT</span>
      </header>

      <section className="space-login-content">
        <div className="space-copy">
          <div className="space-eyebrow">
            <Sparkles size={15} />
            <span>YOUR EMAIL WORKSPACE</span>
          </div>

          <h1>
            Your inbox.
            <br />
            <span>Your universe.</span>
          </h1>

          <p className="space-description">
            Schedule emails, stay organized, and keep every
            important conversation moving forward.
          </p>

          <button
            type="button"
            className="space-google-button"
            onClick={onGoogleLogin}
          >
            <svg
              className="space-google-icon"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                transform="translate(0 4)"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.62 5.91c4.45-4.11 7.14-10.16 7.14-17.56Z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.93 7.57 2.56 10.78l7.97-6.19Z"
                transform="translate(0 0)"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.62-5.91c-2.12 1.42-4.83 2.26-8.28 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
              />
            </svg>
            <span>Continue with Google</span>
            <ArrowRight size={18} className="space-google-arrow" />
          </button>

          <div className="space-security-note">
            <ShieldCheck size={16} />
            <span>Secure sign-in powered by Google</span>
          </div>

          <div className="space-divider">
            <span />
            <span>YOUR NEXT CHAPTER STARTS HERE</span>
            <span />
          </div>

          <p className="space-footer">
            By continuing, you agree to use ReachInbox responsibly.
          </p>
        </div>

        <div className="space-scene" aria-hidden="true">
          <div className="space-orbit space-orbit-outer" />
          <div className="space-orbit space-orbit-inner" />

          <div className="space-planet space-planet-large">
            <div className="space-planet-highlight" />
            <div className="space-planet-ring" />
          </div>

          <div className="space-planet space-planet-small" />
          <div className="space-moon" />
          <div className="space-floating-star star-one">✦</div>
          <div className="space-floating-star star-two">✧</div>
          <div className="space-floating-star star-three">✦</div>

          <div className="space-scene-caption">
            <span className="space-status-dot" />
            <span>ALL SYSTEMS GO</span>
          </div>
        </div>
      </section>
    </main>
  );
}
