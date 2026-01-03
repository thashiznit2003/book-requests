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
    lookup?: ReadarrLookupBook;
  };
  audio: {
    available: boolean;
    alreadyAdded: boolean;
    lookup?: ReadarrLookupBook;
  };
};
