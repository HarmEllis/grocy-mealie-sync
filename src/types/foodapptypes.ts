export type Unit = {
  id?: string;
  name: string;
  pluralName?: string | null;
  description?: string;
  extras?: {
    [key: string]: unknown;
  } | null;
  fraction?: boolean;
  abbreviation?: string;
  pluralAbbreviation?: string | null;
  useAbbreviation?: boolean;
  aliases?:
    | {
        name: string;
      }[]
    | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
