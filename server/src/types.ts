export type ReadarrLookupBook = {
  title?: string;
  authorTitle?: string;
  authorName?: string;
  foreignBookId?: string;
  goodreadsId?: string | number;
  isbn13?: string | number;
  isbn?: string | number;
  asin?: string;
  author?: {
    name?: string;
  };
  [key: string]: unknown;
};

export type ReadarrBook = {
  id?: number;
  title?: string;
  authorTitle?: string;
  authorName?: string;
  foreignBookId?: string;
  goodreadsId?: string | number;
  isbn13?: string | number;
  isbn?: string | number;
  asin?: string;
  author?: {
    name?: string;
  };
  monitored?: boolean;
  bookFileId?: number;
  bookFile?: {
    id?: number;
  };
  statistics?: {
    bookFileCount?: number;
    sizeOnDisk?: number;
  };
};

export type SearchItem = {
  key: string;
  title: string;
  author: string;
  isbn13?: string;
  foreignBookId?: string;
  goodreadsId?: string;
  ebook: {
    available: boolean;
    alreadyAdded: boolean;
    existingId?: number;
    monitored?: boolean;
    hasFile?: boolean;
    lookup?: ReadarrLookupBook;
  };
  audio: {
    available: boolean;
    alreadyAdded: boolean;
    existingId?: number;
    monitored?: boolean;
    hasFile?: boolean;
    lookup?: ReadarrLookupBook;
  };
};
