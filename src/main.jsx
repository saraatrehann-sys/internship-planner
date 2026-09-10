import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Coffee,
  Download,
  ExternalLink,
  FileText,
  Home,
  ArchiveRestore,
  ListChecks,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sun,
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

const roles = ["Consulting", "Product", "Software", "Finance", "Other"];
const statuses = ["Pending", "Applied", "Interview", "Rejected"];
const chatStatuses = ["Pending", "Texted", "Followup"];
const taskViews = ["Daily", "Weekly", "In Progress", "Finished"];
const priorityTags = [
  { value: "", label: "Tag" },
  { value: "urgent", label: "Urgent" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
];
const auraQuotes = [
  "I will do big things",
  "I am creating a life I love",
  "The universe is on my side",
  "I attract success and opportunities in my career.",
  "You have no idea how amazing life is about to get. Just trust the process.",
];
const summerTodos = [
  "Deloitte internship",
  "Artela internship call",
  "Summer classes into two",
  "Be Real externship",
  "Business Today conference",
  "Sparkit internship",
  "Get Green internship",
  "Meet Ceta Mena region",
  "Do three to four product teardowns",
  "Redesign Botim",
  "Prepare for recruiting season",
  "Write blogs about anything interesting in the startup space",
  "Find few UCLA alumni mentors",
  "Set up coffee chats",
  "Experiment with AI",
  "Learn SQL",
];

const defaultSummer2026 = summerTodos.map((text, index) => ({
  id: `summer-${index + 1}`,
  text,
  done: false,
  priority: "",
}));

const emptyState = {
  selectedRole: "Consulting",

  roleTypes: ["Consulting", "Product", "Software", "Finance", "Other"],

  selectedTaskView: "Daily",

  calendarEmbedUrl: "",

  applications: [],

  coffeeChats: [],

  tasks: [],

  meetings: [],

  deloitte: [],

  summer2026: defaultSummer2026,

  notes: [],

  deletedItems: [],
};

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "applications", label: "Role Applications", icon: BriefcaseBusiness },
  { id: "calendar", label: "Google Calendar", icon: CalendarDays },
  { id: "tasks", label: "Daily Tasks", icon: ListChecks },
  { id: "coffee", label: "Coffee Chats", icon: Coffee },
  { id: "notes", label: "Notes", icon: FileText },
];

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyState;
    const parsed = JSON.parse(saved);
    return normalizePlannerState(parsed);
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlannerState(source = {}) {
  return {
    ...emptyState,
    ...source,

    roleTypes:
      source.roleTypes?.length
        ? source.roleTypes
        : ["Consulting", "Product", "Software", "Finance", "Other"],

    applications: source.applications || [],
    coffeeChats: source.coffeeChats || [],
    tasks: (source.tasks || []).map((task) => ({
      ...task,
      day: task.day || todayKey(),
    })),
    meetings: source.meetings || [],
    deloitte: source.deloitte || [],
    notes: source.notes || [],
    summer2026: source.summer2026?.length
      ? source.summer2026
      : defaultSummer2026,
    deletedItems: source.deletedItems || [],
  };
}

function mergeRows(cloudRows = [], localRows = []) {
  const merged = new Map();
  localRows.forEach((row) => merged.set(row.id, row));
  cloudRows.forEach((row) => merged.set(row.id, { ...merged.get(row.id), ...row }));
  return [...merged.values()];
}

function mergePlannerStates(localState, cloudState) {
  const local = normalizePlannerState(localState);
  const cloud = normalizePlannerState(cloudState);
  return {
    ...local,
    ...cloud,
    applications: mergeRows(cloud.applications, local.applications),
    coffeeChats: mergeRows(cloud.coffeeChats, local.coffeeChats),
    tasks: mergeRows(cloud.tasks, local.tasks),
    meetings: mergeRows(cloud.meetings, local.meetings),
    deloitte: mergeRows(cloud.deloitte, local.deloitte),
    notes: mergeRows(cloud.notes, local.notes),
    summer2026: mergeRows(cloud.summer2026, local.summer2026),
    deletedItems: mergeRows(cloud.deletedItems, local.deletedItems),
  };
}

function App() {
  const [state, setState] = useState(() =>
  SUPABASE_READY ? emptyState : loadState());
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [applicationCompanyFilter, setApplicationCompanyFilter] = useState("");
  const [coffeeCompanyFilter, setCoffeeCompanyFilter] = useState("");
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
  const cleanCloudState = normalizePlannerState(cloudState);
  setState(cleanCloudState);
} else {
  const freshState = normalizePlannerState(emptyState);
  setState(freshState);
  await saveCloudPlanner(session, freshState);
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
      setUndoStack((stack) => [...stack.slice(-24), current]);
      setRedoStack([]);
      if (!SUPABASE_READY) {
  saveState(next);
}
      return next;
    });
  };

  const replaceState = (next) => {
    setState(next);
    if (!SUPABASE_READY) {
  saveState(next);
}
  };

  const undo = () => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const previous = stack[stack.length - 1];
      setRedoStack((redo) => [...redo.slice(-24), state]);
      replaceState(previous);
      return stack.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((undoItems) => [...undoItems.slice(-24), state]);
      replaceState(next);
      return stack.slice(0, -1);
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
      const companyMatch = !applicationCompanyFilter || item.company === applicationCompanyFilter;
      const searchMatch = `${item.applicationName} ${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(query.toLowerCase());
      return roleMatch && companyMatch && searchMatch;
    });
  }, [state.applications, state.selectedRole, applicationCompanyFilter, query]);

  const applicationCompanies = useMemo(() => {
    return uniqueCompanies(state.applications.filter((item) => item.role === state.selectedRole));
  }, [state.applications, state.selectedRole]);

  const visibleCoffeeChats = state.coffeeChats.filter((item) =>
    (!coffeeCompanyFilter || item.company === coffeeCompanyFilter)
    && `${item.name} ${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(query.toLowerCase()),
  );

  const coffeeCompanies = useMemo(() => uniqueCompanies(state.coffeeChats), [state.coffeeChats]);

  const visibleNotes = state.notes.filter((item) =>
    `${item.text}`.toLowerCase().includes(query.toLowerCase()),
  );

  const visibleTasks = state.tasks.filter((task) => {
    if (state.selectedTaskView === "Finished") return task.done || task.scope === "Finished";
    if (state.selectedTaskView === "In Progress") return task.scope === "In Progress" && !task.done;
    if (state.selectedTaskView === "Daily") return task.scope === "Daily" && (task.day || todayKey()) === todayKey();
    return task.scope === state.selectedTaskView;
  });
  const visibleDeloitte = state.deloitte.filter((item) => {
    if (state.selectedTaskView === "Finished") return item.done || item.scope === "Finished";
    return item.scope === state.selectedTaskView;
  });

  const updateRow = (collection, id, patch) => {
    updateState((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const deleteRow = (collection, id) => {
    updateState((current) => ({
      ...current,
      deletedItems: [
        {
          id: makeId("deleted"),
          collection,
          item: current[collection].find((entry) => entry.id === id),
          deletedAt: new Date().toISOString(),
        },
        ...(current.deletedItems || []),
      ].filter((entry) => entry.item).slice(0, 100),
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  };

  const restoreDeleted = (deletedId) => {
    updateState((current) => {
      const deleted = (current.deletedItems || []).find((entry) => entry.id === deletedId);
      if (!deleted) return current;
      return {
        ...current,
        [deleted.collection]: [...current[deleted.collection], deleted.item],
        deletedItems: current.deletedItems.filter((entry) => entry.id !== deletedId),
      };
    });
  };

  const removeDeleted = (deletedId) => {
    updateState((current) => ({
      ...current,
      deletedItems: (current.deletedItems || []).filter((entry) => entry.id !== deletedId),
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

    if (["summer", "summer 2026"].some((word) => normalized.includes(word))) {
      setPage("summer");
      return;
    }

    if (["deleted", "recently deleted", "trash", "archive"].some((word) => normalized.includes(word))) {
      setPage("deleted");
      return;
    }

    if (["note", "notes"].some((word) => normalized.includes(word))) {
      setPage("notes");
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
          priority: "",
          day: todayKey(),
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
          priority: "",
        },
      ],
    }));
  };

  const addNote = () => {
    setQuery("");
    setPage("notes");
    updateState((current) => ({
      ...current,
      notes: [...current.notes, { id: makeId("note"), text: "" }],
    }));
  };

  const addSummerTodo = () => {
    setQuery("");
    setPage("summer");
    updateState((current) => ({
      ...current,
      summer2026: [...current.summer2026, { id: makeId("summer"), text: "", done: false, priority: "" }],
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
    setState(normalizePlannerState(emptyState));
setUndoStack([]);
setRedoStack([]);
setPage("home");
localStorage.removeItem(STORAGE_KEY);
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
          undo={undo}
          redo={redo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />

        {page === "home" && (
  <HomePage
    state={state}
    setRoleAndOpen={setRoleAndOpen}
    setTaskAndOpen={setTaskAndOpen}
    openSummer={() => setPage("summer")}
    onAddRole={() => {
      const newRole = window.prompt("Enter a role type");

      if (!newRole) return;

      const cleanedRole = newRole.trim();

      if (!cleanedRole) return;

      updateState((current) => {
        const currentRoles =
          current.roleTypes || [
            "Consulting",
            "Product",
            "Software",
            "Finance",
            "Other",
          ];

        const alreadyExists = currentRoles.some(
          (role) => role.toLowerCase() === cleanedRole.toLowerCase()
        );

        if (alreadyExists) return current;

        return {
          ...current,
          roleTypes: [...currentRoles, cleanedRole],
        };
      });
    }}
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
            <RoleTabs
  roles={state.roleTypes}
  selected={state.selectedRole}
  onSelect={(role) =>
    updateState((current) => ({ ...current, selectedRole: role }))
  }
/>
            <CompanyFilter
              label="Company filter"
              value={applicationCompanyFilter}
              companies={applicationCompanies}
              onChange={setApplicationCompanyFilter}
            />
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
              onDelete={(id) => deleteRow("applications", id)}
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
            <MeetingList
              meetings={state.meetings}
              onChange={(id, patch) => updateRow("meetings", id, patch)}
              onDelete={(id) => deleteRow("meetings", id)}
            />
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
            <CompanyFilter
              label="Company filter"
              value={coffeeCompanyFilter}
              companies={coffeeCompanies}
              onChange={setCoffeeCompanyFilter}
            />
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
              onDelete={(id) => deleteRow("coffeeChats", id)}
            />
          </section>
        )}

        {page === "notes" && (
          <section className="page-card">
            <PageHeader eyebrow="Notes" title="Notes" action="Add note" onAction={addNote} />
            <NoteList
              notes={visibleNotes}
              onChange={(id, patch) => updateRow("notes", id, patch)}
              onDelete={(id) => deleteRow("notes", id)}
            />
          </section>
        )}

      

        {page === "summer" && (
          <section className="page-card">
            <PageHeader eyebrow="Summer 2026" title="To-dos" action="Add item" onAction={addSummerTodo} />
            <SummerTodoList
              items={state.summer2026}
              onChange={(id, patch) => updateRow("summer2026", id, patch)}
              onDelete={(id) => deleteRow("summer2026", id)}
            />
          </section>
        )}

        {page === "deleted" && (
          <section className="page-card">
            <PageHeader eyebrow="Archive" title="Recently Deleted" />
            <RecentlyDeleted
              items={state.deletedItems || []}
              onRestore={restoreDeleted}
              onRemove={removeDeleted}
            />
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

function Topbar({ query, setQuery, exportData, importData, session, syncStatus, signOut, undo, redo, canUndo, canRedo }) {
  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search" />
      </label>
      <div className="topbar-actions">
        <span className="sync-pill">{syncStatus}</span>
        {session && <button className="text-button" onClick={signOut}>Sign out</button>}
        <button className="icon-button" onClick={undo} title="Undo" disabled={!canUndo}><RotateCcw size={18} /></button>
        <button className="icon-button" onClick={redo} title="Redo" disabled={!canRedo}><RotateCw size={18} /></button>
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
          Your one place for all your applications, coffee chats, and to-dos.
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

function HomePage({
  state,
  setRoleAndOpen,
  setTaskAndOpen,
  openSummer,
  onAddRole,
}) {
  return (
    <section className="landing">
      <AuraQuoteCarousel />

      <div className="landing-grid">
        <section className="landing-card">
          <h2>Role type</h2>
          <p>Pick a role to open its application sheet.</p>
          <div className="choice-grid role-grid">
  {state.roleTypes.map((role) => (
    <button
      key={role}
      className={state.selectedRole === role ? "selected" : ""}
      onClick={() => setRoleAndOpen(role)}
    >
      {role}
    </button>
  ))}

  <button type="button" onClick={onAddRole}>
    + Add role
  </button>
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

        <section className="landing-card summer-card">
          <h2>Summer 2026</h2>
          <p>Open the editable to-do list for internships, classes, coffee chats, and recruiting prep.</p>
          <div className="choice-grid summer-choice">
            <button onClick={openSummer}>Open Summer 2026</button>
          </div>
        </section>
      </div>
    </section>
  );
}

function AuraQuoteCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % auraQuotes.length);
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="quote-panel aura-panel" aria-label="Motivational quote carousel">
      <div key={activeIndex} className="aura-quote-card">
        <span>YOU CAN DO IT!!</span>
        <p>{auraQuotes[activeIndex]}</p>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, action, onAction }) {
  return (
    <div className="page-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {action && <button onClick={onAction}><Plus size={16} /> {action}</button>}
    </div>
  );
}

function RoleTabs({ roles, selected, onSelect }) {
  return (
    <div className="tabs">
      {roles.map((role) => (
        <button
          key={role}
          className={selected === role ? "selected" : ""}
          onClick={() => onSelect(role)}
        >
          {role}
        </button>
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

function CompanyFilter({ label, value, companies, onChange }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All companies</option>
        {companies.map((company) => <option key={company} value={company}>{company}</option>)}
      </select>
    </label>
  );
}

function EditableTable({ columns, rows, empty, onChange, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} className={column.wide ? "wide" : ""}>{column.label}</th>)}
            {onDelete && <th className="action-column">Delete</th>}
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
                  ) : (
                    <textarea rows={1} value={row[column.key] || ""} onChange={(event) => onChange(row.id, { [column.key]: event.target.value })} />
                  )}
                </td>
              ))}
              {onDelete && (
                <td className="action-column">
                  <button className="table-delete-button" onClick={() => onDelete(row.id)} aria-label="Delete row">
                    <Trash2 size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="empty" colSpan={columns.length + (onDelete ? 1 : 0)}>{empty}</td>
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

function MeetingList({ meetings, onChange, onDelete }) {
  if (meetings.length === 0) return <div className="empty-card">Use Add meeting note to create a writable row.</div>;
  return (
    <div className="stack-list">
      {meetings.map((meeting) => (
        <article className="meeting-row" key={meeting.id}>
          <textarea
            rows={1}
            value={meeting.title}
            onChange={(event) => onChange(meeting.id, { title: event.target.value })}
            placeholder="Heading"
          />
          <input type="date" value={meeting.date || ""} onChange={(event) => onChange(meeting.id, { date: event.target.value })} />
          <button className="delete-button" onClick={() => onDelete(meeting.id)} aria-label="Delete meeting note">
            <Trash2 size={15} />
          </button>
          <textarea
            className="meeting-notes"
            value={meeting.notes}
            onChange={(event) => onChange(meeting.id, { notes: event.target.value })}
            placeholder="Notes"
          />
        </article>
      ))}
    </div>
  );
}

function NoteList({ notes, onChange, onDelete }) {
  if (notes.length === 0) return <div className="empty-card">Use Add note to create a numbered note box.</div>;
  return (
    <div className="notes-list">
      {notes.map((note, index) => (
        <article className="note-row" key={note.id}>
          <span>{index + 1}</span>
          <textarea
            value={note.text || ""}
            onChange={(event) => onChange(note.id, { text: event.target.value })}
            placeholder="Write a note"
          />
          <button className="delete-button" onClick={() => onDelete(note.id)} aria-label="Delete note">
            <Trash2 size={15} />
          </button>
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
        <article className={`task-row ${task.done ? "done" : ""} ${priorityClass(task.priority)}`} key={task.id}>
          <button
            onClick={() => onChange(task.id, { done: !task.done })}
            aria-label="Toggle task"
          >
            {task.done && <Check size={14} />}
          </button>
          <textarea value={task.text} onChange={(event) => onChange(task.id, { text: event.target.value })} />
          <input type="date" value={task.date} onChange={(event) => onChange(task.id, { date: event.target.value })} />
          <PrioritySelect value={task.priority || ""} onChange={(priority) => onChange(task.id, { priority })} />
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
        <article className={`deloitte-card ${item.done ? "done" : ""} ${priorityClass(item.priority)}`} key={item.id}>
          <div className="deloitte-heading-row">
            <textarea
              rows={1}
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
            <PrioritySelect value={item.priority || ""} onChange={(priority) => onChange(item.id, { priority })} />
            <button
              onClick={() => onChange(item.id, { done: !item.done })}
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

function RecentlyDeleted({ items, onRestore, onRemove }) {
  if (items.length === 0) return <div className="empty-card">Deleted rows and notes will appear here.</div>;

  return (
    <div className="deleted-list">
      {items.map((entry) => (
        <article className="deleted-row" key={entry.id}>
          <div>
            <span>{collectionLabel(entry.collection)}</span>
            <strong>{deletedTitle(entry.item)}</strong>
            <small>{new Date(entry.deletedAt).toLocaleString()}</small>
          </div>
          <button onClick={() => onRestore(entry.id)}>Restore</button>
          <button className="delete-button" onClick={() => onRemove(entry.id)} aria-label="Delete forever">
            <Trash2 size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function collectionLabel(collection) {
  const labels = {
    applications: "Application",
    coffeeChats: "Coffee chat",
    meetings: "Meeting note",
    tasks: "Task",
    notes: "Note",
    deloitte: "Deloitte note",
    summer2026: "Summer 2026",
  };
  return labels[collection] || "Item";
}

function deletedTitle(item = {}) {
  return item.applicationName || item.title || item.heading || item.name || item.text || item.notes || "Untitled";
}

function SummerTodoList({ items, onChange, onDelete }) {
  if (items.length === 0) return <div className="empty-card">Use Add item to create your Summer 2026 to-do list.</div>;
  return (
    <div className="summer-list">
      {items.map((item, index) => (
        <article className={`summer-row ${item.done ? "done" : ""} ${priorityClass(item.priority)}`} key={item.id}>
          <span>{index + 1}</span>
          <button onClick={() => onChange(item.id, { done: !item.done })} aria-label="Toggle Summer 2026 item">
            {item.done && <Check size={14} />}
          </button>
          <textarea rows={1} value={item.text} onChange={(event) => onChange(item.id, { text: event.target.value })} />
          <PrioritySelect value={item.priority || ""} onChange={(priority) => onChange(item.id, { priority })} />
          <button className="delete-button" onClick={() => onDelete(item.id)} aria-label="Delete Summer 2026 item">
            <Trash2 size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function PrioritySelect({ value, onChange }) {
  return (
    <select className="priority-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Priority tag">
      {priorityTags.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
    </select>
  );
}

function priorityClass(priority) {
  return priority ? `priority-${priority}` : "";
}

function uniqueCompanies(items) {
  return [...new Set(items.map((item) => item.company?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

createRoot(document.getElementById("root")).render(<App />);
