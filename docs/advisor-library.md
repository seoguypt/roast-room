# Advisor brains and source retrieval

Each SEO seat keeps its own `brain.md` and `sources.md`. The brain defines the specialty, decision rules, exceptions, a fictional worked example and a distinct report requirement. The examples are editorial teaching material, not purported client stories.

`app/knowledge/advisors/library.json` contains 18 short reviewed source cards from nine public primary sources, including a published whiteboard transcript, talk slides and a host-published interview transcript. These are selective paraphrases, not a comprehensive video archive. A source method is not evidence that a submitted website has a defect.

For every review, local BM25 search ranks material within each selected advisor's corpus using the goal, page signals and audit findings. At most four documents / 6,500 text characters enter that advisor's context. A foundational method may remain relevant without a keyword match. Other unrelated chunks are omitted. The report and discussion reuse the same retrieved snapshot. Source links and the model's explanation of how it applied each method appear in the report; the download includes them too. Stored metadata includes the chunk ID and content hash. Citation IDs are restricted to retrieved documents, and URLs come from server metadata, not generated model output. This validates provenance, not whether the model applied the source correctly.

There is no paid embedding API, new cloud account or vector database. This is lexical retrieval, not semantic vector search. An embedding index can be added later behind `retrieveAdvisor` when the corpus is large enough to evaluate whether it improves retrieval. The generation model remains the app's configured provider.

## Import a reviewed talk transcript

Use a transcript you are allowed to store, such as an authorized caption export or your own reviewed transcription. Support: `.txt`, `.md`, `.vtt`. VTT chunks preserve starting timestamps. Author identity and permission are administrative assertions: confirm them before import, and check speaker attribution, transcription errors, dates, marketing claims and outdated advice. The importer does not scrape YouTube, download audio, or perform speech recognition.

```powershell
npm run brains:import -- --file "C:\path\talk.vtt" --advisor patrick --url "https://example.com/original-talk" --title "Technical SEO talk" --date "2026-10-01" --reviewed yes --rights yes
```

Advisor keys: `aleyda`, `patrick`, `lily`, `cyrus`, `brodie`, `rand`, `brian`, `julian`, `charles`. Each import is bounded to 1 MB and split into 2,400-character chunks. Identical input is deduplicated by content hash. Imported files are private in ignored `knowledge-data/`; they are not uploaded to GitHub. They become context sent to the configured generation provider when retrieved, just like the brain files. Never put credentials or private client transcripts into this corpus.

Set `ADVISOR_LIBRARY_DIR=/data/advisor-library` on a hosted deployment to keep imports on its existing persistent volume. Copy reviewed import JSON files there through an authorized administrator channel; importing locally alone does not sync them to the server. Files are loaded for each review, so imported source material needs no restart. Changes to cached `brain.md` require restarting/redeploying.

## Quality checks

`npm test` checks source validation, advisor isolation, relevant retrieval, bounds, transcript timestamps and actual context/citation flow through a mocked growth review. These tests do not prove fidelity to a real person. Before calling the personalities accurate, evaluate real generated reports on the same fixtures: correct website evidence, relevant method application, meaningful specialty differences, useful exceptions and no manufactured disagreements. Keep a human review of source selection and factual advice.
