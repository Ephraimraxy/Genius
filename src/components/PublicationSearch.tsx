import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, FileText, Download, ExternalLink, Loader2, BookOpen, Calendar, Hash } from 'lucide-react';

interface SearchResult {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
  published_at: string;
  volume?: string | number;
  issue?: string | number;
  url: string;
}

interface PublicationSearchProps {
  token: string | null;
  initialQuery?: string;
}

export default function PublicationSearch({ token, initialQuery }: PublicationSearchProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (initialQuery?.trim()) {
      setQuery(initialQuery);
      doSearch(initialQuery, 1);
    }
  }, [initialQuery]);

  const doSearch = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}&page=${p}&limit=10`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(p);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, 1);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto px-4 py-8 pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-[#800000] mb-2">
          <BookOpen size={28} />
          <span className="font-black uppercase tracking-[0.3em] text-xs">Publication Search</span>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Search Research Archive</h2>
        <p className="text-slate-500 mt-1">Find published articles by author name, title, keyword, or DOI.</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <div className="flex-1 flex items-center bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 gap-3 focus-within:border-[#800000] transition-colors shadow-sm">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Author name, paper title, keyword, or DOI…"
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-[#800000] hover:bg-[#600000] disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </form>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center py-20 gap-4 text-slate-400">
            <Loader2 size={40} className="animate-spin text-[#800000]" />
            <p className="font-medium">Searching archive…</p>
          </motion.div>
        ) : !searched ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 text-slate-400">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-500">Enter a search term to find publications</p>
            <p className="text-sm mt-1">Try an author's name, a keyword, or part of a title</p>
          </motion.div>
        ) : results.length === 0 ? (
          <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 text-slate-400">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-500">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-sm mt-1">Try a different keyword, author name, or partial title</p>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-sm text-slate-500 font-medium">
              {total} result{total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>

            {results.map(paper => (
              <motion.div key={paper.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-red-200 hover:shadow-md transition-all">

                <a href={paper.url} target="_blank" rel="noopener noreferrer"
                  className="text-[#800000] font-bold text-base leading-snug hover:underline block mb-1">
                  {paper.title || 'Untitled'}
                </a>

                {paper.authors.length > 0 && (
                  <p className="text-slate-500 text-sm italic mb-2">{paper.authors.join('; ')}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
                  {paper.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(paper.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </span>
                  )}
                  {paper.volume && (
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      Vol. {paper.volume}{paper.issue ? `, No. ${paper.issue}` : ''}
                    </span>
                  )}
                  {paper.doi && (
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {paper.doi}
                    </span>
                  )}
                </div>

                {paper.abstract && (
                  <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">{paper.abstract}…</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  <a href={paper.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#800000] text-white rounded-lg hover:bg-[#600000] transition-colors">
                    <ExternalLink size={12} /> View Article
                  </a>
                  <a href={`/api/papers/${paper.id}/formatted-download`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                    <Download size={12} /> Download PDF
                  </a>
                  {paper.doi && (
                    <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                      <FileText size={12} /> DOI Link
                    </a>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <button onClick={() => doSearch(query, page - 1)} disabled={page <= 1}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  ← Previous
                </button>
                <span className="text-sm text-slate-500">Page {page} of {pages}</span>
                <button onClick={() => doSearch(query, page + 1)} disabled={page >= pages}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  Next →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
