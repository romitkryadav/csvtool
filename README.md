# RomitCSV

RomitCSV is a browser-based toolbox for working with CSV and TSV files.

## Current tools

- CSV Viewer — preview, search and sort tabular data
- CSV Editor — edit cells, rows and columns
- CSV Cleaner — trim whitespace, remove blank rows, remove duplicates and remove empty columns
- CSV Merger — combine multiple CSV/TSV files
- CSV Splitter — split data into smaller CSV files
- CSV Validator — check row-width consistency
- CSV to JSON
- JSON to CSV

## Privacy model

The tools are designed around client-side processing. Files are handled in the browser rather than uploaded to a RomitCSV backend. The homepage uses IndexedDB only for the temporary handoff from the upload screen to the viewer.

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- Browser File APIs
- IndexedDB

## Development

Serve the repository from a local HTTP server so browser APIs behave consistently. Do not open HTML files directly from the file protocol when testing IndexedDB flows.

## CSV compatibility

The shared CSV engine supports comma, semicolon, tab and pipe delimiters, quoted values, escaped quotes, multiline quoted fields, BOM-prefixed text and CRLF/LF line endings.

## Before production

- Run browser tests for every tool.
- Test malformed and very large files.
- Replace domain-specific metadata with the real production domain.
- Keep privacy claims aligned with the actual deployed scripts and analytics.

## License

Add the project's chosen license before distributing the repository as open source.
