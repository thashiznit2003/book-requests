import axios, { AxiosInstance } from "axios";
import type { ReadarrBook, ReadarrLookupBook, SearchItem } from "./types.js";
import { logger } from "./logger.js";
import type { InstanceSettings } from "./settingsStore.js";

export type InstanceConfig = InstanceSettings;

type LookupResult = ReadarrLookupBook & {
  title?: string;
};

type ExistingInfo = {
  id: number;
  monitored: boolean;
  hasFile: boolean;
};

const normalize = (value: string | number | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const pickAuthor = (book: ReadarrLookupBook | ReadarrBook): string =>
  book.authorTitle || book.authorName || book.author?.name || "Unknown author";

const pickTitle = (book: ReadarrLookupBook | ReadarrBook): string =>
  book.title || "Untitled";

const pickKey = (book: ReadarrLookupBook | ReadarrBook): string => {
  const ids = [
    book.foreignBookId,
    book.goodreadsId,
    book.isbn13,
    book.isbn,
    book.asin
  ];
  for (const id of ids) {
    const normalized = normalize(id);
    if (normalized) {
      return `id:${normalized}`;
    }
  }
  const title = normalize(book.title);
  const author = normalize(pickAuthor(book));
  if (title) {
    return `t:${title}|a:${author}`;
  }
  return "";
};

const pickIsbn13 = (book: ReadarrLookupBook | ReadarrBook): string | undefined => {
  const value = book.isbn13 || book.isbn;
  if (!value) {
    return undefined;
  }
  return String(value);
};

const pickGoodreadsId = (
  book: ReadarrLookupBook | ReadarrBook
): string | undefined => {
  if (!book.goodreadsId) {
    return undefined;
  }
  return String(book.goodreadsId);
};

const createClient = (instance: InstanceConfig): AxiosInstance =>
  axios.create({
    baseURL: instance.baseUrl,
    headers: {
      "X-Api-Key": instance.apiKey
    },
    timeout: 15000
  });

const pickLookupKey = (book: ReadarrLookupBook): string => {
  const key = pickKey(book);
  if (key) {
    return key;
  }
  const title = normalize(book.title);
  const author = normalize(pickAuthor(book));
  const isbn = normalize(pickIsbn13(book));
  return `t:${title}|a:${author}|i:${isbn}`;
};

const lookupBooks = async (
  client: AxiosInstance,
  term: string,
  limit: number
): Promise<LookupResult[]> => {
  const results: LookupResult[] = [];
  const seen = new Set<string>();
  const maxPages = Math.max(1, Math.ceil(limit / 5));

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await client.get<LookupResult[]>("/api/v1/book/lookup", {
      params: { term, limit, pageSize: limit, page }
    });
    const data = response.data || [];
    if (!data.length) {
      break;
    }

    let addedThisPage = 0;
    for (const item of data) {
      const key = pickLookupKey(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(item);
      addedThisPage += 1;
      if (results.length >= limit) {
        return results;
      }
    }

    if (addedThisPage === 0) {
      break;
    }
  }

  return results;
};

const hasFile = (book: ReadarrBook): boolean => {
  if (book.bookFileId) {
    return true;
  }
  if (book.bookFile?.id) {
    return true;
  }
  if ((book.statistics?.bookFileCount ?? 0) > 0) {
    return true;
  }
  return (book.statistics?.sizeOnDisk ?? 0) > 0;
};

const mapExisting = (books: ReadarrBook[]): Map<string, ExistingInfo> => {
  const keys = new Map<string, ExistingInfo>();
  for (const book of books) {
    const key = pickKey(book);
    if (key && book.id != null) {
      keys.set(key, {
        id: book.id,
        monitored: book.monitored ?? true,
        hasFile: hasFile(book)
      });
    }
  }
  return keys;
};

const ingest = (
  items: Map<string, SearchItem>,
  lookup: LookupResult[],
  existingMap: Map<string, ExistingInfo>,
  instance: "ebook" | "audio"
): void => {
  for (const book of lookup) {
    const key = pickKey(book);
    if (!key) {
      continue;
    }
    const existing = existingMap.get(key);
    const alreadyAdded = Boolean(existing && existing.monitored && existing.hasFile);
    const current = items.get(key) || {
      key,
      title: pickTitle(book),
      author: pickAuthor(book),
      isbn13: pickIsbn13(book),
      foreignBookId: book.foreignBookId,
      goodreadsId: pickGoodreadsId(book),
      ebook: { available: false, alreadyAdded: false },
      audio: { available: false, alreadyAdded: false }
    };

    if (instance === "ebook") {
      current.ebook = {
        available: true,
        alreadyAdded,
        existingId: existing?.id,
        monitored: existing?.monitored,
        hasFile: existing?.hasFile,
        lookup: book
      };
    } else {
      current.audio = {
        available: true,
        alreadyAdded,
        existingId: existing?.id,
        monitored: existing?.monitored,
        hasFile: existing?.hasFile,
        lookup: book
      };
    }

    items.set(key, current);
  }
};

export const searchBooks = async (
  ebooks: InstanceConfig,
  audio: InstanceConfig,
  term: string
): Promise<SearchItem[]> => {
  const ebooksClient = createClient(ebooks);
  const audioClient = createClient(audio);
  const lookupLimitRaw = Number(process.env.READARR_LOOKUP_LIMIT);
  const lookupLimit =
    Number.isFinite(lookupLimitRaw) && lookupLimitRaw > 0 ? lookupLimitRaw : 20;

  const [ebookLookup, audioLookup, ebookExisting, audioExisting] =
    await Promise.all([
      lookupBooks(ebooksClient, term, lookupLimit),
      lookupBooks(audioClient, term, lookupLimit),
      ebooksClient.get<ReadarrBook[]>("/api/v1/book"),
      audioClient.get<ReadarrBook[]>("/api/v1/book")
    ]);

  const items = new Map<string, SearchItem>();
  ingest(items, ebookLookup || [], mapExisting(ebookExisting.data || []), "ebook");
  ingest(items, audioLookup || [], mapExisting(audioExisting.data || []), "audio");

  return Array.from(items.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
};

export const requestBook = async (
  instance: InstanceConfig,
  lookup: ReadarrLookupBook,
  existingId?: number
): Promise<void> => {
  const client = createClient(instance);

  if (existingId) {
    let monitorSucceeded = false;
    let searchSucceeded = false;

    try {
      await client.post("/api/v1/book/monitor", {
        bookIds: [existingId],
        monitored: true
      });
      monitorSucceeded = true;
    } catch (error) {
      logger.warn({ err: error }, "book_monitor_failed");
    }

    try {
      await client.post("/api/v1/command", {
        name: "BookSearch",
        bookIds: [existingId]
      });
      searchSucceeded = true;
    } catch (error) {
      logger.warn({ err: error }, "book_search_failed");
    }

    if (monitorSucceeded || searchSucceeded) {
      return;
    }

    const existing = await client.get<ReadarrBook>(`/api/v1/book/${existingId}`);
    const payload = {
      ...existing.data,
      monitored: true,
      rootFolderPath: instance.rootFolderPath,
      qualityProfileId: instance.qualityProfileId
    } as Record<string, unknown>;

    await client.put("/api/v1/book", payload);
    return;
  }

  const payload = {
    ...lookup,
    rootFolderPath: instance.rootFolderPath,
    qualityProfileId: instance.qualityProfileId,
    monitored: true,
    addOptions: {
      searchForNewBook: true
    }
  } as Record<string, unknown>;

  delete payload.id;

  await client.post("/api/v1/book", payload);
};

export const testConnection = async (
  instance: InstanceConfig
): Promise<void> => {
  const client = createClient(instance);
  await client.get("/api/v1/system/status");
};
