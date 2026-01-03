import axios, { AxiosInstance } from "axios";
import type { ReadarrBook, ReadarrLookupBook, SearchItem } from "./types.js";
import type { config } from "./config.js";

export type InstanceConfig = typeof config.ebooks;

type LookupResult = ReadarrLookupBook & {
  title?: string;
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

const mapExisting = (books: ReadarrBook[]): Set<string> => {
  const keys = new Set<string>();
  for (const book of books) {
    const key = pickKey(book);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
};

const ingest = (
  items: Map<string, SearchItem>,
  lookup: LookupResult[],
  existingKeys: Set<string>,
  instance: "ebook" | "audio"
): void => {
  for (const book of lookup) {
    const key = pickKey(book);
    if (!key) {
      continue;
    }
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
        alreadyAdded: existingKeys.has(key),
        lookup: book
      };
    } else {
      current.audio = {
        available: true,
        alreadyAdded: existingKeys.has(key),
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

  const [ebookLookup, audioLookup, ebookExisting, audioExisting] =
    await Promise.all([
      ebooksClient.get<LookupResult[]>("/api/v1/book/lookup", {
        params: { term }
      }),
      audioClient.get<LookupResult[]>("/api/v1/book/lookup", {
        params: { term }
      }),
      ebooksClient.get<ReadarrBook[]>("/api/v1/book"),
      audioClient.get<ReadarrBook[]>("/api/v1/book")
    ]);

  const items = new Map<string, SearchItem>();
  ingest(items, ebookLookup.data || [], mapExisting(ebookExisting.data || []), "ebook");
  ingest(items, audioLookup.data || [], mapExisting(audioExisting.data || []), "audio");

  return Array.from(items.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
};

export const addBook = async (
  instance: InstanceConfig,
  lookup: ReadarrLookupBook
): Promise<void> => {
  const client = createClient(instance);
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
