

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LoginPage from "./LoginPage";

import {

  Inbox,

  Send,

  Clock3,

  Search,

  Plus,

  Settings,

  Mail,

  ChevronDown,

  RefreshCw,

  CalendarClock,

  CheckCircle2,

  AlertCircle,

  X,

  LoaderCircle,

  ChevronLeft,

  ChevronRight,
  LogOut,
  Sparkles,

} from "lucide-react";

import "./App.css";
import "./ai-writer.css";
import "./dashboard-3d.css";



type EmailStatus = "SCHEDULED" | "SENDING" | "SENT";

type Tab = "Scheduled" | "Sent";





interface Email {

  id: string;

  recipient: string;

  subject: string;

  body: string;

  scheduledAt: string;

  status: EmailStatus;

  createdAt: string;

  updatedAt: string;

}



interface EmailResponse {

  data: Email[];

  pagination: {

    page: number;

    limit: number;

    total: number;

    totalPages: number;

  };

}



interface AuthUser {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}

const API_URL = "/api/emails";

const PAGE_SIZE = 5;



function formatDate(value: string) {

  return new Intl.DateTimeFormat("en-IN", {

    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

  }).format(new Date(value));

}



function toLocalDateTimeInput(date: Date) {

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);

}



function App() {

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Scheduled");

  const [search, setSearch] = useState("");

  const [emails, setEmails] = useState<Email[]>([]);

  const [allEmails, setAllEmails] = useState<Email[]>([]);

  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  const [totalFiltered, setTotalFiltered] = useState(0);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [apiConnected, setApiConnected] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvNotice, setCsvNotice] = useState("");
  const [csvResult, setCsvResult] = useState<{
    totalRows: number;
    imported: number;
    invalid: number;
    duplicatesInFile: number;
    alreadyExisted: number;
  } | null>(null);

  const [showCompose, setShowCompose] = useState(false);

  const [recipient, setRecipient] = useState("");

  const [subject, setSubject] = useState("");

  const [body, setBody] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "friendly" | "formal" | "persuasive">("professional");
  const [generatingEmail, setGeneratingEmail] = useState(false);

  const [scheduledAt, setScheduledAt] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);



  const status = activeTab === "Sent" ? "SENT" : "SCHEDULED";

  // Read the clock in an effect, never while React is rendering.
  // Keeping this value fresh also lets the submit handler validate against a recent time.
  useEffect(() => {
    const updateClock = () => {
      // Reading the clock in an effect/timer is safe; it is not part of render.
      const now = Date.now();
      setCurrentTimeMs(now);
      setScheduledAt((previous) =>
        previous || toLocalDateTimeInput(new Date(now + 5 * 60_000)),
      );
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const fetchEmails = useCallback(async () => {

    setError("");



    try {

      const response = await fetch(

        `${API_URL}?page=1&limit=100`,

      );



      if (!response.ok) {

        throw new Error(`Could not load emails (HTTP ${response.status}).`);

      }



      const result: EmailResponse = await response.json();

      setAllEmails(result.data);

      setApiConnected(true);

    } catch (err) {

      setApiConnected(false);

      setError(

        err instanceof Error

          ? err.message

          : "Unable to connect to the backend.",

      );

    }

  }, []);



  const fetchCurrentTab = useCallback(async () => {

    setRefreshing(true);

    setError("");



    try {

      const params = new URLSearchParams({

        status,

        page: String(page),

        limit: String(PAGE_SIZE),

      });



      const response = await fetch(`${API_URL}?${params}`);



      if (!response.ok) {

        throw new Error(`Could not load emails (HTTP ${response.status}).`);

      }



      const result: EmailResponse = await response.json();



      setEmails(result.data);

      setTotalFiltered(result.pagination.total);

      setTotalPages(Math.max(1, result.pagination.totalPages));

      setApiConnected(true);

    } catch (err) {

      setApiConnected(false);

      setError(

        err instanceof Error

          ? err.message

          : "Unable to connect to the backend.",

      );

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [status, page]);



  const refreshAll = useCallback(async () => {

    await Promise.all([fetchEmails(), fetchCurrentTab()]);

  }, [fetchEmails, fetchCurrentTab]);



  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const result: { user: AuthUser } = await response.json();
        if (!cancelled) setUser(result.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

useEffect(() => {
  const timeoutId = window.setTimeout(() => {
    void refreshAll();
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, [refreshAll]);


  const filteredEmails = useMemo(() => {

    const query = search.trim().toLowerCase();



    if (!query) return emails;



    return emails.filter(

      (email) =>

        email.recipient.toLowerCase().includes(query) ||

        email.subject.toLowerCase().includes(query) ||

        email.body.toLowerCase().includes(query),

    );

  }, [emails, search]);



  const counts = useMemo(

    () => ({

      total: allEmails.length,

      scheduled: allEmails.filter(

        (email) => email.status === "SCHEDULED" || email.status === "SENDING",

      ).length,

      sent: allEmails.filter((email) => email.status === "SENT").length,

    }),

    [allEmails],

  );

function openCompose() {
  setShowCompose(true);
}

  // Keep the dialog attached to the viewport, and prevent background scrolling.
  useEffect(() => {
    if (!showCompose) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setShowCompose(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCompose, submitting]);

  function handleGoogleLogin() {
    window.location.href = "/api/auth/google";
  }

  async function handleLogout() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Logout failed. Please try again.");
      setUser(null);
      setNotice("Logged out successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out.");
    }
  }

  async function handleCsvImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Keep CSV feedback independent from the email composer / dashboard notices.
    setCsvError("");
    setCsvNotice("");

    if (!csvFile) {
      setCsvError("Please choose a CSV file before importing.");
      return;
    }

    if (!csvFile.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please select a valid .csv file.");
      return;
    }

    if (csvFile.size === 0) {
      setCsvError("The selected CSV file is empty.");
      return;
    }

    if (csvFile.size > 2 * 1024 * 1024) {
      setCsvError("CSV file must be 2 MB or smaller.");
      return;
    }

    setCsvImporting(true);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile, csvFile.name);

      const response = await fetch("/api/contacts/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        const message = typeof result.error === "string"
          ? result.error
          : typeof result.message === "string"
            ? result.message
            : `CSV import failed (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const asCount = (value: unknown): number => {
        const parsed = typeof value === "number" ? value : Number(value ?? 0);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      };

      setCsvResult({
        totalRows: asCount(result.totalRows),
        imported: asCount(result.imported),
        invalid: asCount(result.invalid),
        duplicatesInFile: asCount(result.duplicatesInFile),
        alreadyExisted: asCount(result.alreadyExisted),
      });

      setCsvNotice(
        typeof result.message === "string" && result.message.trim()
          ? result.message
          : "CSV import completed successfully.",
      );
      setCsvFile(null);
      const fileInput = document.getElementById("csv-contact-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setCsvResult(null);
      setCsvError(err instanceof Error ? err.message : "Unable to import CSV contacts.");
    } finally {
      setCsvImporting(false);
    }
  }

  function changeTab(tab: Tab) {

    setActiveTab(tab);

    setPage(1);

    setSearch("");

  }



  async function handleGenerateEmail() {
    setError("");
    setNotice("");

    if (aiPrompt.trim().length < 3) {
      setError("Please describe what your email should be about.");
      return;
    }

    setGeneratingEmail(true);
    try {
      const response = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          purpose: aiPrompt.trim(),
          tone: aiTone,
          recipient: recipient.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Unable to generate email (HTTP ${response.status}).`);
      }
      if (typeof result.subject !== "string" || typeof result.body !== "string" || !result.subject.trim() || !result.body.trim()) {
        throw new Error("The AI returned an invalid draft. Please try again.");
      }

      setSubject(result.subject);
      setBody(result.body);
      setNotice("AI draft generated. Review and edit it before scheduling.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate email.");
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function handleSchedule(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setError("");

    setNotice("");



    const normalizedRecipient = recipient.trim();
    const normalizedSubject = subject.trim();
    const normalizedBody = body.trim();
    const selectedDate = new Date(scheduledAt);
    // Use the clock state maintained by the effect instead of calling Date.now here.
    const now = currentTimeMs;

    if (!normalizedRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient)) {
      setError("Enter a valid recipient email address.");
      return;
    }

    if (!normalizedSubject) {
      setError("Add a subject before scheduling.");
      return;
    }

    if (!normalizedBody) {
      setError("Write the email message before scheduling.");
      return;
    }

    if (Number.isNaN(selectedDate.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }

    // Keep a short safety buffer so the chosen time is still in the future
    // when the server receives the request.
    if (selectedDate.getTime() < now + 60_000) {
      setError("Choose a time at least 1 minute in the future.");
      return;
    }



    setSubmitting(true);



    try {

      const idempotencyKey = crypto.randomUUID();



      const response = await fetch(`${API_URL}/schedule`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          recipient: normalizedRecipient,

          subject: normalizedSubject,

          body: normalizedBody,

          scheduledAt: selectedDate.toISOString(),

          idempotencyKey,

        }),

      });



      const result = await response.json();



      if (!response.ok) {

        const details = Array.isArray(result.details)

          ? result.details.map((item: { message?: string }) => item.message).join(" ")

          : "";



        throw new Error(result.error || details || "Unable to schedule email.");

      }



      setNotice(result.message || "Email scheduled successfully.");

      setRecipient("");

      setSubject("");

      setBody("");

    const nextScheduleTime = new Date();
nextScheduleTime.setMinutes(nextScheduleTime.getMinutes() + 5);
setScheduledAt(toLocalDateTimeInput(nextScheduleTime));

      setShowCompose(false);

      setActiveTab(result.status === "SENT" ? "Sent" : "Scheduled");

      setPage(1);

      await Promise.all([fetchEmails(), fetchCurrentTabForStatus(result.status)]);

    } catch (err) {

      setError(

        err instanceof Error ? err.message : "Unable to schedule this email.",

      );

    } finally {

      setSubmitting(false);

    }

  }



  async function fetchCurrentTabForStatus(emailStatus?: EmailStatus) {

    const nextStatus = emailStatus === "SENT" ? "SENT" : "SCHEDULED";

    const params = new URLSearchParams({

      status: nextStatus,

      page: "1",

      limit: String(PAGE_SIZE),

    });



    try {

      const response = await fetch(`${API_URL}?${params}`);



      if (!response.ok) {

        throw new Error("Unable to refresh the email list.");

      }



      const result: EmailResponse = await response.json();

      setEmails(result.data);

      setTotalFiltered(result.pagination.total);

      setTotalPages(Math.max(1, result.pagination.totalPages));

      setApiConnected(true);

    } catch (err) {

      setError(

        err instanceof Error ? err.message : "Unable to refresh email list.",

      );

    } finally {

      setLoading(false);

    }

  }




  if (authLoading) {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-loading-orbit" aria-hidden="true" />
        <p>Preparing your universe...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onGoogleLogin={handleGoogleLogin} />;
  }

  return (

    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon"><Mail size={21} /></div>

          <span>ReachInbox</span>

        </div>



        <div className="workspace-card">

          <div className="workspace-avatar">G</div>

          <div className="workspace-info">

            <strong>My Workspace</strong>

            <span>Personal workspace</span>

          </div>

          <ChevronDown size={16} />

        </div>



        <div className="nav-label">WORKSPACE</div>



        <button

          className={`nav-item ${activeTab === "Scheduled" ? "selected" : ""}`}

          onClick={() => changeTab("Scheduled")}

        >

          <Inbox size={18} />

          <span>All emails</span>

          <span className="nav-count">{counts.total}</span>

        </button>



        <button

          className={`nav-item ${activeTab === "Scheduled" ? "selected" : ""}`}

          onClick={() => changeTab("Scheduled")}

        >

          <Clock3 size={18} />

          <span>Scheduled</span>

          <span className="nav-count">{counts.scheduled}</span>

        </button>



        <button

          className={`nav-item ${activeTab === "Sent" ? "selected" : ""}`}

          onClick={() => changeTab("Sent")}

        >

          <Send size={18} />

          <span>Sent</span>

          <span className="nav-count">{counts.sent}</span>

        </button>



        <div className="sidebar-bottom">

          <div className="sidebar-help">

            <div className="help-icon"><Mail size={17} /></div>

            <strong>Email scheduler</strong>

            <p>Manage your outgoing messages in one place.</p>

          </div>



          <button className="nav-item settings-item" onClick={() => setNotice("Settings will be available when account settings are implemented.")}>

            <Settings size={18} />

            <span>Settings</span>

          </button>



          <div className="profile">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="profile-avatar" />
            ) : (
              <div className="profile-avatar">
                {user?.name?.charAt(0).toUpperCase() ?? "G"}
              </div>
            )}
            <div className="profile-info">
              <strong>{user?.name ?? (authLoading ? "Loading account..." : "Guest user")}</strong>
              <span>{user?.email ?? "Not signed in"}</span>
            </div>
            {user && (
              <button
                className="logout-button"
                onClick={() => void handleLogout()}
                title="Log out"
                aria-label="Log out"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>

        </div>

      </aside>



      <main className="main-content">

        <header className="topbar">

          <div className="breadcrumb">Workspace <span>/</span> Email scheduler</div>

          <div className="topbar-right">

            <span className={`connection-dot ${apiConnected ? "" : "offline"}`} />

            {apiConnected ? "Backend connected" : "Backend disconnected"}

            <button

              className="icon-button"

              title="Refresh emails"

              onClick={() => void refreshAll()}

              disabled={refreshing}

            >

              <RefreshCw size={16} className={refreshing ? "spin" : ""} />

            </button>

          </div>

        </header>



        <section className="page-content">

          <div className="page-heading">

            <div>

              <div className="eyebrow">WORKSPACE OVERVIEW</div>

              <h1>Email scheduler</h1>

              <p>Manage your scheduled and sent emails.</p>

            </div>

            <div className="page-heading-actions">
              {!authLoading && !user && (
                <button className="secondary-button" onClick={handleGoogleLogin}>
                  Sign in with Google
                </button>
              )}
              <button className="primary-button" onClick={openCompose}>
                <Plus size={17} /> Compose email
              </button>
            </div>

          </div>



          {notice && (

            <div className="notice">

              <CheckCircle2 size={17} />

              <span>{notice}</span>

              <button className="notice-close" onClick={() => setNotice("")} aria-label="Dismiss notice">

                <X size={15} />

              </button>

            </div>

          )}



          {error && (

            <div className="error-banner">

              <AlertCircle size={17} />

              <span>{error}</span>

              <button className="notice-close" onClick={() => setError("")} aria-label="Dismiss error">

                <X size={15} />

              </button>

            </div>

          )}



          <div className="stats-grid">

            <div className="stat-card">

              <div className="stat-top">

                <span>Total emails</span>

                <div className="stat-icon purple"><Mail size={18} /></div>

              </div>

              <div className="stat-number">{counts.total}</div>

              <span className="stat-caption">Loaded from your workspace</span>

            </div>



            <div className="stat-card">

              <div className="stat-top">

                <span>Scheduled</span>

                <div className="stat-icon blue"><CalendarClock size={18} /></div>

              </div>

              <div className="stat-number">{counts.scheduled}</div>

              <span className="stat-caption">Waiting to be sent</span>

            </div>



            <div className="stat-card">

              <div className="stat-top">

                <span>Sent</span>

                <div className="stat-icon green"><CheckCircle2 size={18} /></div>

              </div>

              <div className="stat-number">{counts.sent}</div>

              <span className="stat-caption">Successfully processed</span>

            </div>

          </div>



          <section className="email-panel csv-import-panel">
            <div className="panel-heading">
              <div>
                <h2>Import leads from CSV</h2>
                <p>Upload your contacts and import up to 1,000 leads at once.</p>
              </div>
            </div>

            <form className="csv-import-form" onSubmit={handleCsvImport}>
              <label className="csv-file-input" htmlFor="csv-contact-file">
                <span className="csv-file-label">
                  <Plus size={17} />
                  Choose CSV file
                </span>
                <input
                  id="csv-contact-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={csvImporting}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    setCsvFile(null);
                    setCsvResult(null);
                    setCsvError("");
                    setCsvNotice("");

                    if (!file) return;
                    if (!file.name.toLowerCase().endsWith(".csv")) {
                      setCsvError("Please select a valid .csv file.");
                      event.currentTarget.value = "";
                      return;
                    }
                    if (file.size === 0) {
                      setCsvError("The selected CSV file is empty.");
                      event.currentTarget.value = "";
                      return;
                    }
                    if (file.size > 2 * 1024 * 1024) {
                      setCsvError("CSV file must be 2 MB or smaller.");
                      event.currentTarget.value = "";
                      return;
                    }
                    setCsvFile(file);
                  }}
                />
              </label>

              <div className="csv-file-details">
                {csvFile ? (
                  <>
                    <strong>{csvFile.name}</strong>
                    <span>{(csvFile.size / 1024).toFixed(1)} KB</span>
                  </>
                ) : (
                  <span>Select a .csv file (maximum 2 MB)</span>
                )}
              </div>

              <button
                className="primary-button csv-import-button"
                type="submit"
                disabled={!csvFile || csvImporting}
              >
                {csvImporting ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Importing contacts...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Import contacts
                  </>
                )}
              </button>
            </form>

            {csvNotice && (
              <div className="notice csv-import-feedback" role="status" aria-live="polite">
                <CheckCircle2 size={17} />
                <span>{csvNotice}</span>
                <button className="notice-close" type="button" onClick={() => setCsvNotice("")} aria-label="Dismiss CSV success message">
                  <X size={15} />
                </button>
              </div>
            )}

            {csvError && (
              <div className="error-banner csv-import-feedback" role="alert">
                <AlertCircle size={17} />
                <span>{csvError}</span>
                <button className="notice-close" type="button" onClick={() => setCsvError("")} aria-label="Dismiss CSV error">
                  <X size={15} />
                </button>
              </div>
            )}

            <p className="csv-import-hint">
              Required column: email. Optional columns: firstName, lastName,
              company, jobTitle and notes.
            </p>

            {csvResult && (
              <div className="csv-import-result" role="status" aria-live="polite">
                <h3>Import summary</h3>
                <div className="csv-result-grid">
                  <div className="csv-result-item">
                    <span>Rows processed</span>
                    <strong>{csvResult.totalRows}</strong>
                  </div>
                  <div className="csv-result-item">
                    <span>Imported</span>
                    <strong>{csvResult.imported}</strong>
                  </div>
                  <div className="csv-result-item">
                    <span>Invalid rows</span>
                    <strong>{csvResult.invalid}</strong>
                  </div>
                  <div className="csv-result-item">
                    <span>Duplicates in file</span>
                    <strong>{csvResult.duplicatesInFile}</strong>
                  </div>
                  <div className="csv-result-item">
                    <span>Already existed</span>
                    <strong>{csvResult.alreadyExisted}</strong>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="email-panel">

            <div className="panel-heading">

              <div>

                <h2>Your emails</h2>

                <p>Review and manage your outgoing emails.</p>

              </div>

              <button

                className="secondary-button"

                onClick={openCompose}

              >

                <Plus size={16} /> New email

              </button>

            </div>



            <div className="toolbar">

              <div className="tabs">

                <button

                  className={activeTab === "Scheduled" ? "tab active-tab" : "tab"}

                  onClick={() => changeTab("Scheduled")}

                >

                  <Clock3 size={15} /> Scheduled

                  <span className="tab-count">{counts.scheduled}</span>

                </button>



                <button

                  className={activeTab === "Sent" ? "tab active-tab" : "tab"}

                  onClick={() => changeTab("Sent")}

                >

                  <Send size={15} /> Sent

                  <span className="tab-count">{counts.sent}</span>

                </button>

              </div>



              <label className="search-box">

                <Search size={16} />

                <input

                  placeholder="Search recipient or subject..."

                  value={search}

                  onChange={(event) => setSearch(event.target.value)}

                />

                {search && (

                  <button className="search-clear" onClick={() => setSearch("")} type="button" aria-label="Clear search">

                    <X size={13} />

                  </button>

                )}

              </label>

            </div>



            <div className="email-table">

              <div className="table-header">

                <span>RECIPIENT / SUBJECT</span>

                <span>STATUS</span>

                <span>SCHEDULED TIME</span>

              </div>



              {loading ? (

                <div className="empty-state">

                  <LoaderCircle size={24} className="spin" />

                  <strong>Loading emails...</strong>

                </div>

              ) : filteredEmails.length > 0 ? (

                filteredEmails.map((email) => (

                  <div className="email-row" key={email.id}>

                    <div className="recipient-cell">

                      <div className="email-avatar">

                        {email.recipient[0]?.toUpperCase() ?? "?"}

                      </div>

                      <div className="email-details">

                        <strong>{email.recipient}</strong>

                        <span>{email.subject}</span>

                      </div>

                    </div>



                    <div>

                      <span className={`status-pill ${email.status.toLowerCase()}`}>

                        {email.status === "SENT" ? (

                          <CheckCircle2 size={13} />

                        ) : (

                          <Clock3 size={13} />

                        )}

                        {email.status === "SENT"

                          ? "Sent"

                          : email.status === "SENDING"

                            ? "Sending"

                            : "Scheduled"}

                      </span>

                    </div>



                    <span className="scheduled-time">

                      {formatDate(email.scheduledAt)}

                    </span>

                  </div>

                ))

              ) : (

                <div className="empty-state">

                  <div className="empty-icon"><AlertCircle size={22} /></div>

                  <strong>{search ? "No matching emails" : "No emails found"}</strong>

                  <span>

                    {search

                      ? "Try a different recipient or subject."

                      : "Schedule an email to see it listed here."}

                  </span>

                  {!search && (

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={openCompose}
                    >

                      <Plus size={15} /> Compose email

                    </button>

                  )}

                </div>

              )}

            </div>



            <div className="table-footer">

              <span>

                Showing {filteredEmails.length} of {totalFiltered} emails

              </span>

              <div className="pagination">

                <span>Page {page} of {totalPages}</span>

                <button

                  className="icon-button small-icon"

                  disabled={page <= 1 || loading}

                  onClick={() => setPage((current) => Math.max(1, current - 1))}

                  aria-label="Previous page"

                >

                  <ChevronLeft size={15} />

                </button>

                <button

                  className="icon-button small-icon"

                  disabled={page >= totalPages || loading}

                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}

                  aria-label="Next page"

                >

                  <ChevronRight size={15} />

                </button>

              </div>

            </div>

          </section>



          <p className="footer-note">

            ReachInbox Scheduler <span>·</span> Reliable email delivery management

          </p>

        </section>

      </main>



      {showCompose && createPortal((

        <div className="modal-backdrop" onClick={() => !submitting && setShowCompose(false)}>

          <div className="compose-modal" onClick={(event) => event.stopPropagation()}>

            
<div className="modal-heading">
  <div className="modal-title-group">
    <div className="modal-title-icon">
      <Mail size={21} />
    </div>

    <div className="modal-title-text">
      <h2>Compose email</h2>
      <p>Prepare a message for scheduled delivery.</p>
    </div>
  </div>

  <button
    className="icon-button"
    onClick={() => setShowCompose(false)}
    disabled={submitting}
    aria-label="Close compose form"
  >
    <X size={17} />
  </button>
</div>



            <form onSubmit={handleSchedule}>
              <section className="ai-writer-panel" aria-labelledby="ai-writer-title">
                <div className="ai-writer-heading">
                  <Sparkles size={18} aria-hidden="true" />
                  <div>
                    <strong id="ai-writer-title">AI Email Writer</strong>
                    <p>Describe your email and AI will create a draft for you.</p>
                  </div>
                </div>

                <label>
                  What should this email be about?
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. Write a professional follow-up after my interview."
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    disabled={generatingEmail || submitting}
                  />
                </label>

                <label>
                  Writing tone
                  <select
                    value={aiTone}
                    onChange={(event) => setAiTone(event.target.value as "professional" | "friendly" | "formal" | "persuasive")}
                    disabled={generatingEmail || submitting}
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="persuasive">Persuasive</option>
                  </select>
                </label>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void handleGenerateEmail()}
                  disabled={generatingEmail || submitting || !aiPrompt.trim()}
                >
                  {generatingEmail ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                  {generatingEmail ? "Generating draft..." : "Generate email"}
                </button>
                <p className="ai-writer-hint">The generated subject and message appear below. Review and edit them before scheduling.</p>
              </section>

              <label>

                Recipient

                <input

                  required

                  type="email"

                  maxLength={254}

                  placeholder="name@example.com"

                  value={recipient}

                  onChange={(event) => setRecipient(event.target.value)}

                  disabled={submitting}

                />

              </label>



              <label>

                Subject

                <input

                  required

                  maxLength={200}

                  placeholder="Email subject"

                  value={subject}

                  onChange={(event) => setSubject(event.target.value)}

                  disabled={submitting}

                />

              </label>



              <label>

                Message

                <textarea

                  required

                  rows={5}

                  maxLength={20000}

                  placeholder="Write your message..."

                  value={body}

                  onChange={(event) => setBody(event.target.value)}

                  disabled={submitting}

                />

              </label>



            <label>
             Schedule time

            <input
               required
               type="datetime-local"
               min={currentTimeMs ? toLocalDateTimeInput(new Date(currentTimeMs + 60_000)) : undefined}
               value={scheduledAt}
               onChange={(event) => setScheduledAt(event.target.value)}
               disabled={submitting}
             />
           </label>

              <div className="schedule-preview" aria-live="polite">
                <div className="schedule-preview-icon"><CalendarClock size={18} /></div>
                <div className="schedule-preview-copy">
                  <strong>Delivery time</strong>
                  <span>
                    {Number.isNaN(new Date(scheduledAt).getTime())
                      ? "Choose a valid date and time"
                      : new Date(scheduledAt).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </span>
                  <small>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time"}</small>
                </div>
              </div>

              <div className="form-hint">
                <Clock3 size={14} />
                Schedule at least one minute ahead. Keep this app's worker and backend running for delivery.
              </div>



              <div className="modal-actions">

                <button

                  className="secondary-button"

                  type="button"

                  onClick={() => setShowCompose(false)}

                  disabled={submitting}

                >

                  Cancel

                </button>

                <button

                  className="primary-button"

                  type="submit"

                  disabled={submitting || !recipient.trim() || !subject.trim() || !body.trim()}

                >

                  {submitting ? (

                    <LoaderCircle size={16} className="spin" />

                  ) : (

                    <CalendarClock size={16} />

                  )}

                  {submitting ? "Scheduling..." : "Schedule email"}

                </button>

              </div>

            </form>

          </div>

        </div>

      ), document.body)}

    </div>

  );

}



export default App;
