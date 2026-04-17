import { useState, useEffect } from "react";
import { resultsService } from "../services/results.service.ts";
import type { RepoAuditResult, AuditListItem } from "../services/results.service.ts";

export function useResultsList() {
  const [results, setResults] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resultsService
      .list()
      .then(setResults)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { results, loading, error };
}

export function useResult(auditId: string | undefined) {
  const [result, setResult] = useState<RepoAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) return;
    setLoading(true);
    resultsService
      .get(auditId)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [auditId]);

  return { result, loading, error };
}
