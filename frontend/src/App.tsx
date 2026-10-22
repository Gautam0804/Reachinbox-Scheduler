

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ArrowUpDown,
  CalendarDays,
  Timer,

} from "lucide-react";

import "./App.css";
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
  const [dateFilter, setDateFilter] = useState<"all" | "24h" | "7d">("all");
  const [sortOrder, setSortOrder] = useState<"soonest" | "latest">("soonest");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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

  const [showCompose, setShowCompose] = useState(false);

const [minimumScheduleTime, setMinimumScheduleTime] = useState(() =>
  toLocalDateTimeInput(new Date(Date.now() + 1_000))
);

  const [recipient, setRecipient] = useState("");

  const [subject, setSubject] = useState("");

  const [body, setBody] = useState("");

  const [scheduledAt, setScheduledAt] = useState(() =>

    toLocalDateTimeInput(new Date(Date.now() + 5 * 60_000)),

  );



  const status = activeTab === "Sent" ? "SENT" : "SCHEDULED";



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


  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  // Search the larger locally cached email set, not just the five rows on the
  // current server-paginated page. Normal browsing still uses server pagination.
  const filteredEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = currentTime;
    const cutoff = dateFilter === "24h"
      ? now + 24 * 60 * 60 * 1000
      : dateFilter === "7d"
        ? now + 7 * 24 * 60 * 60 * 1000
        : Number.POSITIVE_INFINITY;
    // Use the full locally cached list whenever searching or filtering dates;
    // otherwise keep the existing server-paginated page for normal browsing.
    const sourceEmails = (query || dateFilter !== "all")
      ? allEmails.filter((email) => activeTab === "Sent"
          ? email.status === "SENT"
          : email.status === "SCHEDULED" || email.status === "SENDING")
      : emails;

    return sourceEmails
      .filter((email) => {
        const matchesSearch = !query ||
          email.recipient.toLowerCase().includes(query) ||
          email.subject.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query);
        const scheduledTime = new Date(email.scheduledAt).getTime();
        const matchesDate = dateFilter === "all" ||
          (scheduledTime >= now && scheduledTime <= cutoff);
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        const difference = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        return sortOrder === "soonest" ? difference : -difference;
      });
  }, [emails, allEmails, search, dateFilter, sortOrder, activeTab, currentTime]);

  const upcomingEmails = useMemo(() => {
    const now = currentTime;
    return allEmails
      .filter((email) =>
        (email.status === "SCHEDULED" || email.status === "SENDING") &&
        new Date(email.scheduledAt).getTime() >= now
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 4);
  }, [allEmails, currentTime]);


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
  setMinimumScheduleTime(
    toLocalDateTimeInput(new Date(Date.now() + 1_000))
  );
  setShowCompose(true);
}

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

  function changeTab(tab: Tab) {

    setActiveTab(tab);

    setPage(1);

    setSearch("");
    setDateFilter("all");
    setSortOrder("soonest");

  }



  async function handleSchedule(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setError("");

    setNotice("");



    const selectedDate = new Date(scheduledAt);



const now = new Date().getTime();

if (selectedDate.getTime() < now + 1_000) {
  setError("Please choose a schedule time at least 1 second in the future.");
  return;
}



    setSubmitting(true);



    try {

      const idempotencyKey = crypto.randomUUID();



      const response = await fetch(`${API_URL}/schedule`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          recipient: recipient.trim(),

          subject: subject.trim(),

          body: body.trim(),

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
                <CalendarClock size={17} /> Schedule email
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

          <section className="upcoming-panel" aria-labelledby="upcoming-title">
            <div className="upcoming-heading">
              <div className="upcoming-heading-icon"><Timer size={18} /></div>
              <div>
                <h2 id="upcoming-title">Upcoming schedule</h2>
                <p>Your next emails in delivery order</p>
              </div>
              <span className="upcoming-count">{upcomingEmails.length} upcoming</span>
            </div>
            {upcomingEmails.length ? (
              <div className="upcoming-list">
                {upcomingEmails.map((email, index) => (
                  <div className="upcoming-item" key={email.id}>
                    <div className="timeline-marker"><span>{index + 1}</span></div>
                    <div className="upcoming-email-info">
                      <strong>{email.subject || "(No subject)"}</strong>
                      <span>{email.recipient}</span>
                    </div>
                    <div className="upcoming-time">
                      <strong>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(email.scheduledAt))}</strong>
                      <span>{new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(email.scheduledAt))}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="upcoming-empty"><CalendarClock size={17} /> No upcoming emails. Schedule one to see it here.</div>
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

                onClick={() => setShowCompose(true)}

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

                  placeholder="Search emails, recipients, or subjects..."

                  value={search}

                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}

                />

                {search && (

                  <button className="search-clear" onClick={() => { setSearch(""); setPage(1); }} type="button" aria-label="Clear search">

                    <X size={13} />

                  </button>

                )}

              </label>

              <div className="email-filter-controls" aria-label="Email filters">
                <label className="filter-select-label">
                  <CalendarDays size={15} />
                  <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value as "all" | "24h" | "7d"); setPage(1); }} aria-label="Filter by schedule time">
                    <option value="all">All dates</option>
                    <option value="24h">Next 24 hours</option>
                    <option value="7d">Next 7 days</option>
                  </select>
                </label>
                <label className="filter-select-label">
                  <ArrowUpDown size={15} />
                  <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as "soonest" | "latest"); setPage(1); }} aria-label="Sort emails by schedule time">
                    <option value="soonest">Soonest first</option>
                    <option value="latest">Latest first</option>
                  </select>
                </label>
              </div>

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

                    <button className="secondary-button" onClick={() => setShowCompose(true)}>

                      <CalendarClock size={15} /> Schedule email

                    </button>

                  )}

                </div>

              )}

            </div>



            <div className="table-footer">

              <span>

                Showing {filteredEmails.length} of {search.trim() ? filteredEmails.length : totalFiltered} emails

              </span>

              <div className="pagination">

                <span>Page {page} of {totalPages}</span>

                <button

                  className="icon-button small-icon"

                  disabled={page <= 1 || loading || Boolean(search.trim())}

                  onClick={() => setPage((current) => Math.max(1, current - 1))}

                  aria-label="Previous page"

                >

                  <ChevronLeft size={15} />

                </button>

                <button

                  className="icon-button small-icon"

                  disabled={page >= totalPages || loading || Boolean(search.trim())}

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



      {showCompose && (

        <div className="modal-backdrop" onClick={() => !submitting && setShowCompose(false)}>

          <div className="compose-modal" onClick={(event) => event.stopPropagation()}>

            
<div className="modal-heading">
  <div className="modal-title-group">
    <div className="modal-title-icon">
      <Mail size={21} />
    </div>

    <div className="modal-title-text">
      <h2>Schedule email</h2>
      <p>Write your message and choose when it should arrive.</p>
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

              <label>

                Recipient

                <input

                  required

                  type="email"

                  maxLength={254}

                  placeholder="name@example.com"

                  value={recipient}

                  onChange={(event) => setRecipient(event.target.value)}

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

                />

              </label>



            <label>
             Schedule time

            <input
               required
               type="datetime-local"
               min={minimumScheduleTime}
               value={scheduledAt}
               onChange={(event) => setScheduledAt(event.target.value)}
             />
           </label>



              <div className="form-hint">

                <Clock3 size={14} />

                Choose a future date and time for delivery.

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

                  disabled={submitting}

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

      )}

    </div>

  );

}



export default App;
