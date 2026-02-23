export type JsonSchemaProperty = {
  type?: string;
  enum?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  format?: string;
  nullable?: boolean;
  label?: string;
  description?: string;
  default?: string | number | boolean;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean;
};

export type JsonObjectSchema = {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties: boolean;
};

export type BlockTypeSchema = {
  id: string;
  name: string | null;
  defaultSection: string;
  subtitleTemplate: string;
  dataSchema: JsonObjectSchema;
  category: string;
  icon: string | null;
  color: string | null;
};

export type SchemasResponse = {
  blockTypes: BlockTypeSchema[];
  pillarIcons: {
    endpoint: string;
    description: string;
    values: string[];
  };
  todoSchema: {
    listQuery: JsonObjectSchema;
    readQuery: JsonObjectSchema;
    create: JsonObjectSchema;
    update: JsonObjectSchema;
    createResponse: JsonObjectSchema;
    updateResponse: JsonObjectSchema;
  };
  habitSchema: {
    listQuery: JsonObjectSchema;
    readQuery: JsonObjectSchema;
    create: JsonObjectSchema;
    update: JsonObjectSchema;
    log: JsonObjectSchema;
    createResponse: JsonObjectSchema;
    updateResponse: JsonObjectSchema;
  };
  daySchema: {
    batchPush: JsonSchemaProperty;
  };
  pointEventSchema: {
    endpoint: string;
    allocation: JsonObjectSchema;
    create: JsonObjectSchema;
    listQuery: JsonObjectSchema;
    rollupQuery: JsonObjectSchema;
  };
  eventTypes: string[];
};

export type SchemaFetchResult =
  | { ok: true; data: SchemasResponse; sourceUrl: string }
  | { ok: false; error: string; sourceUrl: string };

const DEFAULT_API_BASE = "https://pillars-phi.vercel.app";

function getApiBaseUrl() {
  const fromEnv = process.env.PILLARS_API_BASE_URL?.trim();
  if (!fromEnv) {
    return DEFAULT_API_BASE;
  }
  return fromEnv.replace(/\/+$/, "");
}

export async function fetchSchemas(): Promise<SchemaFetchResult> {
  const baseUrl = getApiBaseUrl();
  const sourceUrl = `${baseUrl}/api/schemas`;
  const apiKey = process.env.PILLARS_API_KEY?.trim();
  const internalSecret = process.env.PILLARS_INTERNAL_SERVICE_SECRET?.trim();
  const userId = process.env.PILLARS_USER_ID?.trim();

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  } else if (internalSecret && userId) {
    headers.Authorization = `Bearer ${internalSecret}`;
    headers["x-user-id"] = userId;
  } else {
    return {
      ok: false,
      sourceUrl,
      error: "Set PILLARS_API_KEY or (PILLARS_INTERNAL_SERVICE_SECRET + PILLARS_USER_ID)."
    };
  }

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        ok: false,
        sourceUrl,
        error: `Schemas request failed: HTTP ${response.status}`
      };
    }

    const data = (await response.json()) as SchemasResponse;
    return {
      ok: true,
      sourceUrl,
      data
    };
  } catch (error) {
    return {
      ok: false,
      sourceUrl,
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}
