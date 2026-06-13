import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Coffee,
  Download,
  ExternalLink,
  Home,
  ListChecks,
  Plus,
  Search,
  Upload,
  Trash2,
  Users,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "career-os.personal.light.v3";
const SESSION_KEY = "career-os.supabase.session.v1";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const roles = ["Consulting", "Product", "Software", "Finance", "Deloitte"];
const statuses = ["Pending", "Applied", "Interview", "Rejected"];
const chatStatuses = ["Pending", "Texted", "Followup"];
const taskViews = ["Daily", "Weekly", "In Progress", "Finished"];

const emptyState = {
  selectedRole: "Consulting",
  selectedTaskView: "Daily",
  calendarEmbedUrl: "",
  applications: [],
  coffeeChats: [],
  tasks: [],
  meetings: [],
  deloitte: [],
};

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "applications", label: "Role Applications", icon: BriefcaseBusiness },
  { id: "calendar", label: "Google Calendar", icon: CalendarDays },
  { id: "tasks", label: "Daily Tasks", icon: ListChecks },
  { id: "coffee", label: "Coffee Chats", icon: Coffee },
  { id: "deloitte", label: "Deloitte 2026", icon: Users },
];

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyState, ...JSON.parse(saved) } : emptyState;
  } catch {
    return emptyState;
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function loadSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

async function supabaseFetch(path, options = {}) {
  const token = options.token;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || "Something went wrong.");
  }
  return data;
}

async function signInWithPassword(email, password) {
  return supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function signUpWithPassword(email, password) {
  return supabaseFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function loadCloudPlanner(session) {
  const rows = await supabaseFetch(`/rest/v1/planner_data?select=data&user_id=eq.${session.user.id}`, {
    method: "GET",
    token: session.access_token,
  });
  return rows?.[0]?.data || null;
}

async function saveCloudPlanner(session, data) {
  return supabaseFetch("/rest/v1/planner_data?on_conflict=user_id", {
    method: "POST",
    token: session.access_token,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: session.user.id,
      data,
      updated_at: new Date().toISOString(),
    }),
  });
}

function makeId(prefix) {
  return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}`;
}

function googleCalendarUrl() {
  return "https://calendar.google.com/calendar/u/0/r/day";
}

function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(loadSession);
  const [cloudReady, setCloudReady] = useState(!SUPABASE_READY);
  const [syncStatus, setSyncStatus] = useState(SUPABASE_READY ? "Sign in to sync" : "Local only");

  useEffect(() => {
    if (!SUPABASE_READY || !session) return;
    let cancelled = false;

    async function hydrateCloudState() {
      try {
        setSyncStatus("Loading saved planner");
        const cloudState = await loadCloudPlanner(session);
        if (cancelled) return;
        if (cloudState) {
          const merged = { ...emptyState, ...cloudState };
          setState(merged);
          saveState(merged);
        } else {
          await saveCloudPlanner(session, state);
        }
        setCloudReady(true);
        setSyncStatus("Synced");
      } catch (error) {
        setCloudReady(true);
        setSyncStatus(error.message);
      }
    }

    hydrateCloudState();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!SUPABASE_READY || !session || !cloudReady) return;
    setSyncStatus("Saving");
    const timeout = window.setTimeout(async () => {
      try {
        await saveCloudPlanner(session, state);
        setSyncStatus("Synced");
      } catch (error) {
        setSyncStatus(error.message);
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [state, session, cloudReady]);

  const updateState = (recipe) => {
    setState((current) => {
      const next = typeof recipe === "function" ? recipe(current) : recipe;
      saveState(next);
      return next;
    });
  };

  const setRoleAndOpen = (role) => {
    updateState((current) => ({ ...current, selectedRole: role }));
    setPage("applications");
  };

  const setTaskAndOpen = (taskView) => {
    updateState((current) => ({ ...current, selectedTaskView: taskView }));
    setPage("tasks");
  };

  const roleApplications = useMemo(() => {
    return state.applications.filter((item) => {
      const roleMatch = item.role === state.selectedRole;
      const searchMatch = `${item.applicationName} ${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(query.toLowerCase());
      return roleMatch && searchMatch;
    });
  }, [state.applications, state.selectedRole, query]);

  const visibleCoffeeChats = state.coffeeChats.filter((item) =>
    `${item.name} ${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(query.toLowerCase()),
  );

  const visibleTasks = state.tasks.filter((task) => task.scope === state.selectedTaskView);
  const visibleDeloitte = state.deloitte.filter((item) => item.scope === state.selectedTaskView);

  const updateRow = (collection, id, patch) => {
    updateState((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const deleteRow = (collection, id) => {
    updateState((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  };

  const handleSearch = (value) => {
    setQuery(value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;

    if (["deloitte", "2026"].some((word) => normalized.includes(word))) {
      setPage("deloitte");
      return;
    }

    const matchedRole = roles.find((role) => role.toLowerCase().includes(normalized) || normalized.includes(role.toLowerCase()));
    if (matchedRole) {
      updateState((current) => ({ ...current, selectedRole: matchedRole }));
      setPage("applications");
      return;
    }

    if (["application", "applications", "apply"].some((word) => normalized.includes(word))) {
      setPage("applications");
      return;
    }
    if (["calendar", "meeting", "meetings", "google"].some((word) => normalized.includes(word))) {
      setPage("calendar");
      return;
    }
    if (["task", "tasks", "daily", "weekly", "todo", "to do"].some((word) => normalized.includes(word))) {
      if (normalized.includes("weekly")) updateState((current) => ({ ...current, selectedTaskView: "Weekly" }));
      if (normalized.includes("daily")) updateState((current) => ({ ...current, selectedTaskView: "Daily" }));
      if (normalized.includes("progress")) updateState((current) => ({ ...current, selectedTaskView: "In Progress" }));
      if (normalized.includes("finished") || normalized.includes("done")) updateState((current) => ({ ...current, selectedTaskView: "Finished" }));
      setPage("tasks");
      return;
    }
    if (["coffee", "chat", "chats", "network"].some((word) => normalized.includes(word))) {
      setPage("coffee");
      return;
    }
  };

  const addApplication = () => {
    setQuery("");
    setPage("applications");
    updateState((current) => ({
      ...current,
      applications: [
        ...current.applications,
        {
          id: makeId("app"),
          applicationName: "",
          company: "",
          role: current.selectedRole,
          deadline: "",
          notes: "",
          status: "Pending",
        },
      ],
    }));
  };

  const addCoffeeChat = () => {
    setQuery("");
    setPage("coffee");
    updateState((current) => ({
      ...current,
      coffeeChats: [
        ...current.coffeeChats,
        { id: makeId("chat"), name: "", company: "", role: "", linkedin: "", notes: "", status: "Pending" },
      ],
    }));
  };

  const addTask = () => {
    setQuery("");
    setPage("tasks");
    updateState((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: makeId("task"),
          scope: current.selectedTaskView === "Finished" ? "In Progress" : current.selectedTaskView,
          date: "",
          text: "",
          done: false,
        },
      ],
    }));
  };

  const addMeeting = () => {
    setQuery("");
    setPage("calendar");
    updateState((current) => ({
      ...current,
      meetings: [...current.meetings, { id: makeId("meeting"), title: "", notes: "", date: "" }],
    }));
  };

  const addDeloitte = () => {
    setQuery("");
    setPage("deloitte");
    updateState((current) => ({
      ...current,
      deloitte: [
        ...current.deloitte,
        {
          id: makeId("deloitte"),
          heading: "",
          notes: "",
          date: "",
          scope: current.selectedTaskView === "Finished" ? "In Progress" : current.selectedTaskView,
          done: false,
        },
      ],
    }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "internship-planner-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        updateState(JSON.parse(reader.result));
      } catch {
        alert("That file could not be opened.");
      }
    };
    reader.readAsText(file);
  };

  const handleAuth = async (mode, email, password) => {
    const authResponse = mode === "signup"
      ? await signUpWithPassword(email, password)
      : await signInWithPassword(email, password);
    if (!authResponse.access_token) {
      throw new Error("Check your email to confirm your account, then sign in.");
    }
    const nextSession = {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
      user: authResponse.user,
    };
    saveSession(nextSession);
    setCloudReady(false);
    setSession(nextSession);
  };

  const signOut = () => {
    saveSession(null);
    setSession(null);
    setCloudReady(false);
    setSyncStatus(SUPABASE_READY ? "Signed out" : "Local only");
  };

  if (SUPABASE_READY && !session) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="workspace">
        <Topbar
          query={query}
          setQuery={handleSearch}
          exportData={exportData}
          importData={importData}
          session={session}
          syncStatus={syncStatus}
          signOut={signOut}
        />

        {page === "home" && (
          <HomePage
            state={state}
            setRoleAndOpen={setRoleAndOpen}
            setTaskAndOpen={setTaskAndOpen}
            updateState={updateState}
          />
        )}

        {page === "applications" && (
          <section className="page-card">
            <PageHeader
              eyebrow="Applications"
              title={`${state.selectedRole} applications`}
              action="Add row"
              onAction={addApplication}
            />
            <RoleTabs selected={state.selectedRole} onSelect={(role) => updateState((current) => ({ ...current, selectedRole: role }))} />
            <EditableTable
              columns={[
                { key: "applicationName", label: "Application" },
                { key: "company", label: "Company" },
                { key: "role", label: "Role", type: "select", options: roles },
                { key: "deadline", label: "Deadline", type: "date" },
                { key: "notes", label: "Notes", wide: true },
                { key: "status", label: "Status", type: "select", options: statuses },
              ]}
              rows={roleApplications}
              empty={`No ${state.selectedRole} applications yet.`}
              onChange={(id, patch) => updateRow("applications", id, patch)}
            />
          </section>
        )}

        {page === "calendar" && (
          <section className="page-card">
            <PageHeader eyebrow="Calendar" title="Today’s meetings" action="Add meeting note" onAction={addMeeting} />
            <div className="calendar-tools">
              <a className="calendar-button" href={googleCalendarUrl()} target="_blank" rel="noreferrer">
                <ExternalLink size={17} /> Open Google Calendar
              </a>
              <label className="embed-field">
                <span>Calendar embed link</span>
                <input
                  value={state.calendarEmbedUrl || ""}
                  onChange={(event) => updateState((current) => ({ ...current, calendarEmbedUrl: event.target.value }))}
                />
              </label>
            </div>
            <CalendarEmbed value={state.calendarEmbedUrl} />
            <MeetingList meetings={state.meetings} onChange={(id, patch) => updateRow("meetings", id, patch)} />
          </section>
        )}

        {page === "tasks" && (
          <section className="page-card">
            <PageHeader eyebrow="Tasks" title={`${state.selectedTaskView} task list`} action="Add task box" onAction={addTask} />
            <TaskTabs selected={state.selectedTaskView} onSelect={(taskView) => updateState((current) => ({ ...current, selectedTaskView: taskView }))} />
            <TaskList tasks={visibleTasks} onChange={(id, patch) => updateRow("tasks", id, patch)} onDelete={(id) => deleteRow("tasks", id)} />
          </section>
        )}

        {page === "coffee" && (
          <section className="page-card">
            <PageHeader eyebrow="Networking" title="Coffee chats" action="Add row" onAction={addCoffeeChat} />
            <EditableTable
              columns={[
                { key: "name", label: "Name" },
                { key: "company", label: "Company" },
                { key: "role", label: "Role" },
                { key: "linkedin", label: "LinkedIn" },
                { key: "notes", label: "Notes", wide: true },
                { key: "status", label: "Status", type: "select", options: chatStatuses },
              ]}
              rows={visibleCoffeeChats}
              empty="No coffee chats yet."
              onChange={(id, patch) => updateRow("coffeeChats", id, patch)}
            />
          </section>
        )}

        {page === "deloitte" && (
          <section className="page-card">
            <PageHeader eyebrow="Deloitte 2026" title="Deloitte 2026" action="Add note box" onAction={addDeloitte} />
            <TaskTabs selected={state.selectedTaskView} onSelect={(taskView) => updateState((current) => ({ ...current, selectedTaskView: taskView }))} />
            <DeloitteList people={visibleDeloitte} onChange={(id, patch) => updateRow("deloitte", id, patch)} onDelete={(id) => deleteRow("deloitte", id)} />
          </section>
        )}
      </main>
    </div>
  );
}

function Sidebar({ page, setPage }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div>
          <strong>Internship Planner</strong>
        </div>
      </div>
      <nav>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({ query, setQuery, exportData, importData, session, syncStatus, signOut }) {
  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search" />
      </label>
      <div className="topbar-actions">
        <span className="sync-pill">{syncStatus}</span>
        {session && <button className="text-button" onClick={signOut}>Sign out</button>}
        <button className="icon-button" onClick={exportData} title="Download backup"><Download size={18} /></button>
        <label className="icon-button" title="Import backup">
          <Upload size={18} />
          <input type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0])} />
        </label>
      </div>
    </header>
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onAuth(mode === "signup" ? "signup" : "signin", email, password);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="kicker">Private internship planner</p>
        <h1>{mode === "signin" ? "Sign in to your planner." : "Create your private planner."}</h1>
        <p className="auth-copy">
          Your applications, tasks, coffee chats, and Deloitte notes sync to your own Supabase database after login.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button disabled={loading}>{loading ? "One moment" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="auth-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function HomePage({ state, setRoleAndOpen, setTaskAndOpen }) {
  return (
    <section className="landing">
      <div className="quote-panel">
        <p className="kicker">For the version of you who keeps showing up</p>
        <h1>Your future internship is a paper trail of tiny brave moves.</h1>
        <p>
          One application, one follow-up, one coffee chat, one clear note. That is how the offer starts looking for you too.
        </p>
      </div>

      <div className="landing-grid">
        <section className="landing-card">
          <h2>Role type</h2>
          <p>Pick a role to open its application sheet.</p>
          <div className="choice-grid">
            {roles.map((role) => (
              <button key={role} className={state.selectedRole === role ? "selected" : ""} onClick={() => setRoleAndOpen(role)}>
                {role}
              </button>
            ))}
          </div>
        </section>

        <section className="landing-card">
          <h2>Task view</h2>
          <p>Choose how you want to plan your next steps.</p>
          <div className="choice-grid two">
            {taskViews.map((view) => (
              <button key={view} className={state.selectedTaskView === view ? "selected" : ""} onClick={() => setTaskAndOpen(view)}>
                {view}
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PageHeader({ eyebrow, title, action, onAction }) {
  return (
    <div className="page-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <button onClick={onAction}><Plus size={16} /> {action}</button>
    </div>
  );
}

function RoleTabs({ selected, onSelect }) {
  return (
    <div className="tabs">
      {roles.map((role) => (
        <button key={role} className={selected === role ? "selected" : ""} onClick={() => onSelect(role)}>{role}</button>
      ))}
    </div>
  );
}

function TaskTabs({ selected, onSelect }) {
  return (
    <div className="tabs">
      {taskViews.map((view) => (
        <button key={view} className={selected === view ? "selected" : ""} onClick={() => onSelect(view)}>{view}</button>
      ))}
    </div>
  );
}

function EditableTable({ columns, rows, empty, onChange }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} className={column.wide ? "wide" : ""}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} className={column.wide ? "wide" : ""}>
                  {column.type === "select" ? (
                    <select value={row[column.key]} onChange={(event) => onChange(row.id, { [column.key]: event.target.value })}>
                      {column.options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : column.type === "date" ? (
                    <input type="date" value={row[column.key]} onChange={(event) => onChange(row.id, { [column.key]: event.target.value })} />
                  ) : column.wide ? (
                    <textarea value={row[column.key]} onChange={(event) => onChange(row.id, { [column.key]: event.target.value })} />
                  ) : (
                    <input value={row[column.key]} onChange={(event) => onChange(row.id, { [column.key]: event.target.value })} />
                  )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="empty" colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CalendarEmbed({ value }) {
  const src = normalizeCalendarEmbed(value);
  if (!src) {
    return (
      <div className="calendar-embed empty-card">
        Paste your Google Calendar embed link above to show your calendar inside this page.
      </div>
    );
  }

  return <iframe className="calendar-embed" title="Google Calendar" src={src} loading="lazy" />;
}

function normalizeCalendarEmbed(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/src=["']([^"']+)["']/);
  const url = match ? match[1] : trimmed;
  if (!url.startsWith("https://calendar.google.com/")) return "";
  return url;
}

function MeetingList({ meetings, onChange }) {
  if (meetings.length === 0) return <div className="empty-card">Use Add meeting note to create a writable row.</div>;
  return (
    <div className="stack-list">
      {meetings.map((meeting) => (
        <article className="meeting-row" key={meeting.id}>
          <input value={meeting.title} onChange={(event) => onChange(meeting.id, { title: event.target.value })} />
          <input type="date" value={meeting.date || ""} onChange={(event) => onChange(meeting.id, { date: event.target.value })} />
          <textarea value={meeting.notes} onChange={(event) => onChange(meeting.id, { notes: event.target.value })} />
        </article>
      ))}
    </div>
  );
}

function TaskList({ tasks, onChange, onDelete }) {
  if (tasks.length === 0) return <div className="empty-card">Use Add task box to create a checkbox and writing space.</div>;
  return (
    <div className="stack-list">
      {tasks.map((task) => (
        <article className={task.done ? "task-row done" : "task-row"} key={task.id}>
          <button
            onClick={() => onChange(task.id, { done: !task.done, scope: task.done ? "In Progress" : "Finished" })}
            aria-label="Toggle task"
          >
            {task.done && <Check size={14} />}
          </button>
          <textarea value={task.text} onChange={(event) => onChange(task.id, { text: event.target.value })} />
          <input type="date" value={task.date} onChange={(event) => onChange(task.id, { date: event.target.value })} />
          <button className="delete-button" onClick={() => onDelete(task.id)} aria-label="Delete task">
            <Trash2 size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function DeloitteList({ people, onChange, onDelete }) {
  if (people.length === 0) return <div className="empty-card">Use Add note box to create Deloitte notes and to-dos.</div>;
  return (
    <div className="deloitte-grid">
      {people.map((item) => (
        <article className={item.done ? "deloitte-card done" : "deloitte-card"} key={item.id}>
          <div className="deloitte-heading-row">
            <input
              value={item.heading || item.name || ""}
              onChange={(event) => onChange(item.id, { heading: event.target.value })}
              placeholder="Heading"
            />
            <input type="date" value={item.date || ""} onChange={(event) => onChange(item.id, { date: event.target.value })} />
          </div>
          <textarea
            className="deloitte-notes"
            value={item.notes || ""}
            onChange={(event) => onChange(item.id, { notes: event.target.value })}
            placeholder="Notes"
          />
          <div className="deloitte-footer">
            <select value={item.scope} onChange={(event) => onChange(item.id, { scope: event.target.value })}>
              {taskViews.map((view) => <option key={view}>{view}</option>)}
            </select>
            <button
              onClick={() => onChange(item.id, { done: !item.done, scope: item.done ? "In Progress" : "Finished" })}
              aria-label="Toggle Deloitte task"
            >
              {item.done && <Check size={14} />}
            </button>
            <button className="delete-button" onClick={() => onDelete(item.id)} aria-label="Delete Deloitte note">
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
