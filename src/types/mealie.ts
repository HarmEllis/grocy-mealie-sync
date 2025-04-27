export type ResponseList<T> = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
  next: string | null;
  previous: string | null;
};

export type Unit = {
  id: string;
  name: string;
  pluralName: string | null;
  description: string;
  extras: object;
  fraction: boolean;
  abbreviation: string;
  pluralAbbreviation: string;
  useAbbreviation: boolean;
  aliases: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
};
