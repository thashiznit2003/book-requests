import { useCallback, useEffect, useMemo, useState } from "react";

type InstanceStatus = {
  available: boolean;
  alreadyAdded: boolean;
  lookup?: Record<string, unknown>;
};

type SearchItem = {
  key: string;
  title: string;
  author: string;
  isbn13?: string;
  foreignBookId?: string;
  goodreadsId?: string;
  ebook: InstanceStatus;
  audio: InstanceStatus;
};

type InstanceSettings = {
  baseUrl: string;
  apiKey: string;
  rootFolderPath: string;
  qualityProfileId: number;
};

type InstanceSettingsForm = {
  baseUrl: string;
  apiKey: string;
  rootFolderPath: string;
  qualityProfileId: string;
};

type SettingsForm = {
  ebooks: InstanceSettingsForm;
  audio: InstanceSettingsForm;
};

type SettingsResponse = {
  configured: boolean;
  settings?: {
    ebooks: InstanceSettings;
    audio: InstanceSettings;
  };
};

type RequestState = "idle" | "loading" | "success" | "error";

type RequestKey = `${string}-ebook` | `${string}-audio`;

type InstanceKey = "ebooks" | "audio";

type TestResult = {
  state: RequestState;
  message?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "";
const AUTH_TOKEN = import.meta.env.VITE_AUTH || "";

const instanceLabels = {
  ebook: "Request Ebook",
  audio: "Request Audiobook"
} as const;

const defaultForm: SettingsForm = {
  ebooks: {
    baseUrl: "",
    apiKey: "",
    rootFolderPath: "/books/ebooks",
    qualityProfileId: "1"
  },
  audio: {
    baseUrl: "",
    apiKey: "",
    rootFolderPath: "/books/audiobooks",
    qualityProfileId: "1"
  }
};

const toSettingsForm = (settings?: SettingsResponse["settings"]): SettingsForm => {
  if (!settings) {
    return defaultForm;
  }

  return {
    ebooks: {
      baseUrl: settings.ebooks.baseUrl || "",
      apiKey: settings.ebooks.apiKey || "",
      rootFolderPath: settings.ebooks.rootFolderPath || "/books/ebooks",
      qualityProfileId: String(settings.ebooks.qualityProfileId ?? "")
    },
    audio: {
      baseUrl: settings.audio.baseUrl || "",
      apiKey: settings.audio.apiKey || "",
      rootFolderPath: settings.audio.rootFolderPath || "/books/audiobooks",
      qualityProfileId: String(settings.audio.qualityProfileId ?? "")
    }
  };
};

const normalizeAuthHeader = (token: string): string => {
  const trimmed = token.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("Basic ") || trimmed.startsWith("Bearer ")) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
};

const buildRequestKey = (key: string, instance: "ebook" | "audio"): RequestKey =>
  `${key}-${instance}`;

const App = () => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<Record<RequestKey, RequestState>>(
    {}
  );
  const [configured, setConfigured] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsForm>(defaultForm);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [authToken, setAuthToken] = useState(AUTH_TOKEN);
  const [testResults, setTestResults] = useState<Record<InstanceKey, TestResult>>({
    ebooks: { state: "idle" },
    audio: { state: "idle" }
  });

  const canSearch = term.trim().length > 2 && configured;
  const hasResults = results.length > 0;

  const authHeader = normalizeAuthHeader(authToken);
  const authHeaders = useMemo(
    () => (authHeader ? { Authorization: authHeader } : {}),
    [authHeader]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("bookRequestsAuth");
    if (stored && stored !== authToken) {
      setAuthToken(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!authToken) {
      window.localStorage.removeItem("bookRequestsAuth");
    } else {
      window.localStorage.setItem("bookRequestsAuth", authToken);
    }
  }, [authToken]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsNotice(null);

    try {
      const response = await fetch(`${API_BASE}/api/settings`, {
        headers: {
          ...authHeaders
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to load settings.");
      }

      const payload = (await response.json()) as SettingsResponse;

      const isConfigured = Boolean(payload.configured && payload.settings);
      setConfigured(isConfigured);
      setSettings(toSettingsForm(payload.settings));
      setShowSettings(!isConfigured);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load settings.";
      setSettingsNotice(message);
      setConfigured(false);
      setShowSettings(true);
    } finally {
      setSettingsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const resultCountLabel = useMemo(() => {
    if (!hasResults) {
      return "";
    }
    return `${results.length} match${results.length === 1 ? "" : "es"}`;
  }, [hasResults, results.length]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) {
      setError(
        configured ? "Type at least 3 characters to search." : "Finish setup first."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/search?term=${encodeURIComponent(term.trim())}`,
        {
          headers: {
            ...authHeaders
          }
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Search failed.");
      }

      const payload = (await response.json()) as { items: SearchItem[] };
      setResults(payload.items || []);
      setRequestState({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed.";
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const requestBook = async (item: SearchItem, instance: "ebook" | "audio") => {
    const lookup = instance === "ebook" ? item.ebook.lookup : item.audio.lookup;
    if (!lookup) {
      return;
    }

    const key = buildRequestKey(item.key, instance);
    setRequestState((prev) => ({ ...prev, [key]: "loading" }));
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/request/${instance === "ebook" ? "ebook" : "audiobook"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ book: lookup })
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Request failed.");
      }

      setResults((prev) =>
        prev.map((entry) =>
          entry.key === item.key
            ? {
                ...entry,
                [instance]: {
                  ...entry[instance],
                  alreadyAdded: true
                }
              }
            : entry
        )
      );
      setRequestState((prev) => ({ ...prev, [key]: "success" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setRequestState((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const updateInstanceField = (
    instance: InstanceKey,
    field: keyof InstanceSettingsForm,
    value: string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [instance]: {
        ...prev[instance],
        [field]: value
      }
    }));
  };

  const buildSettingsPayload = () => ({
    ebooks: {
      baseUrl: settings.ebooks.baseUrl.trim(),
      apiKey: settings.ebooks.apiKey.trim(),
      rootFolderPath: settings.ebooks.rootFolderPath.trim(),
      qualityProfileId: Number(settings.ebooks.qualityProfileId)
    },
    audio: {
      baseUrl: settings.audio.baseUrl.trim(),
      apiKey: settings.audio.apiKey.trim(),
      rootFolderPath: settings.audio.rootFolderPath.trim(),
      qualityProfileId: Number(settings.audio.qualityProfileId)
    }
  });

  const handleSaveSettings = async () => {
    setSettingsNotice(null);
    setSavingSettings(true);

    try {
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ settings: buildSettingsPayload() })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to save settings.");
      }

      setConfigured(true);
      setShowSettings(false);
      setSettingsNotice("Settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save settings.";
      setSettingsNotice(message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async (instance: InstanceKey) => {
    setTestResults((prev) => ({
      ...prev,
      [instance]: { state: "loading" }
    }));
    setSettingsNotice(null);

    try {
      const response = await fetch(`${API_BASE}/api/settings/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          instance,
          settings: buildSettingsPayload()[instance]
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Connection failed.");
      }

      setTestResults((prev) => ({
        ...prev,
        [instance]: { state: "success", message: "Connected" }
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setTestResults((prev) => ({
        ...prev,
        [instance]: { state: "error", message }
      }));
    }
  };

  const setupTitle = configured ? "Settings" : "Finish setup";
  const searchHint = configured
    ? loading
      ? "Talking to Readarr..."
      : "Buttons will disable when a book is already added."
    : "Configure Readarr first, then search for requests.";

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__copy">
          <div className="hero__top">
            <p className="eyebrow">Readarr Request Hub</p>
            {configured && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowSettings((prev) => !prev)}
              >
                {showSettings ? "Close settings" : "Settings"}
              </button>
            )}
          </div>
          <h1>Request new books in seconds.</h1>
          <p className="lede">
            Search once, then send a request to the ebook or audiobook library
            instantly.
          </p>
        </div>
        <div className="hero__panel">
          <form onSubmit={handleSearch} className="search">
            <label htmlFor="search" className="search__label">
              Title, author, or ISBN
            </label>
            <div className="search__row">
              <input
                id="search"
                type="text"
                placeholder="Try: The Hobbit, Tolkien, 9780618968633"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                disabled={!configured}
              />
              <button type="submit" disabled={!canSearch || loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <p className="search__hint">{searchHint}</p>
          </form>
        </div>
      </header>

      {(showSettings || !configured) && (
        <section className="settings">
          <div className="settings__header">
            <div>
              <h2>{setupTitle}</h2>
              <p>Provide Readarr URLs, API keys, and defaults.</p>
            </div>
          </div>

          <div className="settings__auth">
            <div className="field">
              <label>Access token (optional)</label>
              <input
                type="password"
                placeholder="Bearer token or shared password"
                value={authToken}
                onChange={(event) => setAuthToken(event.target.value)}
              />
              <span className="field__hint">
                Used for API calls when AUTH is enabled.
              </span>
            </div>
            <button
              type="button"
              className="button button--ghost"
              onClick={loadSettings}
              disabled={settingsLoading}
            >
              {settingsLoading ? "Loading..." : "Reload"}
            </button>
          </div>

          {settingsNotice && <div className="notice">{settingsNotice}</div>}

          <div className="settings__grid">
            {(["ebooks", "audio"] as InstanceKey[]).map((instance) => {
              const label = instance === "ebooks" ? "Ebooks" : "Audiobooks";
              const instanceSettings = settings[instance];
              const testResult = testResults[instance];

              return (
                <div key={instance} className="settings__panel">
                  <h3>{label}</h3>
                  <div className="field">
                    <label>Base URL</label>
                    <input
                      type="text"
                      placeholder="http://10.0.0.20:8787"
                      value={instanceSettings.baseUrl}
                      onChange={(event) =>
                        updateInstanceField(instance, "baseUrl", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label>API key</label>
                    <input
                      type="password"
                      placeholder="Readarr API key"
                      value={instanceSettings.apiKey}
                      onChange={(event) =>
                        updateInstanceField(instance, "apiKey", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Root folder path</label>
                    <input
                      type="text"
                      placeholder="/books/ebooks"
                      value={instanceSettings.rootFolderPath}
                      onChange={(event) =>
                        updateInstanceField(
                          instance,
                          "rootFolderPath",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Quality profile ID</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={instanceSettings.qualityProfileId}
                      onChange={(event) =>
                        updateInstanceField(
                          instance,
                          "qualityProfileId",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="settings__panel-actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => handleTestConnection(instance)}
                      disabled={testResult.state === "loading"}
                    >
                      {testResult.state === "loading"
                        ? "Testing..."
                        : "Test connection"}
                    </button>
                    {testResult.state === "success" && (
                      <span className="status status--ok">Connected</span>
                    )}
                    {testResult.state === "error" && (
                      <span className="status status--error">
                        {testResult.message || "Failed"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="settings__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={handleSaveSettings}
              disabled={settingsLoading || savingSettings}
            >
              {savingSettings ? "Saving..." : "Save settings"}
            </button>
          </div>
        </section>
      )}

      <main className="results">
        <div className="results__header">
          <h2>Results</h2>
          {resultCountLabel && <span>{resultCountLabel}</span>}
        </div>

        {error && <div className="error">{error}</div>}

        {!loading && !hasResults && (
          <div className="empty">
            <p>
              {configured
                ? "Search for a book to get started."
                : "Complete setup to start searching."}
            </p>
          </div>
        )}

        <div className="results__grid">
          {results.map((item, index) => {
            const ebookKey = buildRequestKey(item.key, "ebook");
            const audioKey = buildRequestKey(item.key, "audio");
            const ebookState = requestState[ebookKey] || "idle";
            const audioState = requestState[audioKey] || "idle";

            return (
              <article
                key={item.key}
                className="card"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="card__meta">
                  <h3>{item.title}</h3>
                  <p>{item.author}</p>
                  <div className="card__ids">
                    {item.isbn13 && <span>ISBN {item.isbn13}</span>}
                    {item.goodreadsId && <span>GR {item.goodreadsId}</span>}
                  </div>
                </div>

                <div className="card__actions">
                  <button
                    type="button"
                    className="action action--primary"
                    disabled={
                      !item.ebook.available ||
                      item.ebook.alreadyAdded ||
                      ebookState === "loading"
                    }
                    onClick={() => requestBook(item, "ebook")}
                  >
                    {item.ebook.alreadyAdded
                      ? "Already added"
                      : ebookState === "loading"
                      ? "Requesting..."
                      : instanceLabels.ebook}
                  </button>
                  {!item.ebook.available && (
                    <span className="status">Not available</span>
                  )}
                  {ebookState === "success" && (
                    <span className="status status--ok">Queued</span>
                  )}
                </div>

                <div className="card__actions">
                  <button
                    type="button"
                    className="action action--ghost"
                    disabled={
                      !item.audio.available ||
                      item.audio.alreadyAdded ||
                      audioState === "loading"
                    }
                    onClick={() => requestBook(item, "audio")}
                  >
                    {item.audio.alreadyAdded
                      ? "Already added"
                      : audioState === "loading"
                      ? "Requesting..."
                      : instanceLabels.audio}
                  </button>
                  {!item.audio.available && (
                    <span className="status">Not available</span>
                  )}
                  {audioState === "success" && (
                    <span className="status status--ok">Queued</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default App;
