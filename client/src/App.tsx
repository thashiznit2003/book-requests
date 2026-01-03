import { useMemo, useState } from "react";

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

type RequestState = "idle" | "loading" | "success" | "error";

type RequestKey = `${string}-ebook` | `${string}-audio`;

const API_BASE = import.meta.env.VITE_API_BASE || "";
const AUTH_TOKEN = import.meta.env.VITE_AUTH || "";

const authHeaders = AUTH_TOKEN
  ? { Authorization: AUTH_TOKEN.startsWith("Basic ") ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}` }
  : {};

const instanceLabels = {
  ebook: "Request Ebook",
  audio: "Request Audiobook"
} as const;

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

  const canSearch = term.trim().length > 2;
  const hasResults = results.length > 0;

  const resultCountLabel = useMemo(() => {
    if (!hasResults) {
      return "";
    }
    return `${results.length} match${results.length === 1 ? "" : "es"}`;
  }, [hasResults, results.length]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) {
      setError("Type at least 3 characters to search.");
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

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Readarr Request Hub</p>
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
              />
              <button type="submit" disabled={!canSearch || loading}>
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="search__hint">
              {loading
                ? "Talking to Readarr…"
                : "Buttons will disable when a book is already added."}
            </p>
          </form>
        </div>
      </header>

      <main className="results">
        <div className="results__header">
          <h2>Results</h2>
          {resultCountLabel && <span>{resultCountLabel}</span>}
        </div>

        {error && <div className="error">{error}</div>}

        {!loading && !hasResults && (
          <div className="empty">
            <p>Search for a book to get started.</p>
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
                      ? "Requesting…"
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
                      ? "Requesting…"
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
