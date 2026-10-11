---
name: mufg-exchange-rates
description: Fetch MUFG Bank exchange rates (TTS/TTB/TTM) from MURC for currency conversion, tax-related recordkeeping, and financial data lookup. Covers 31+ currencies daily since 1990, monthly/yearly summaries, world rates, and reference rates.
---

# MUFG Exchange Rates

Typed wrapper for MUFG Bank exchange rates published by MURC (三菱UFJリサーチ＆コンサルティング).

## API

| Function | Description | Range |
| --- | --- | --- |
| `convertCurrency(options)` | Convert between JPY and one foreign currency using daily TTS/TTB/TTM | 1990+ |
| `fetchRates(date)` | Daily TTS/TTB/TTM for all currencies | 1990+ |
| `fetchDaily(date?)` | Daily TTS/TTB + cash selling/buying rates | 2005+ |
| `fetchMonthly(year, month)` | Month-end + monthly average + local market rates | 2005-09+ |
| `fetchYearly(year)` | Year-end + yearly average | 2003+ |
| `fetchWorld()` | ~73 countries vs USD | Latest month |
| `fetchReference(year)` | 8 additional currencies (TWD, BRL, etc.) | 2006+ |
| `getArchiveSourceUrl(year)` | Official yearly XLS URL | 1990+ |
| `downloadArchiveSource(year)` | Untouched yearly XLS bytes | 1990+ |
| `parseArchiveWorkbook(xlsBuffer)` | Parse a caller-provided yearly XLS workbook | 1990+ |

## Quick Start

```ts
import { fetchRates } from 'mufg-rates';

const result = await fetchRates('2025-01-06');
if (result) {
  const usd = result.rates.USD;
  console.log(usd.ttm); // 104
}
```

## CLI

```bash
# Daily TTS/TTB/TTM for a specific date
mufg-rates rates 2025-01-06
mufg-rates rates 2025-01-06 --currency USD

# Convert between JPY and one foreign currency
mufg-rates convert -a 100 -f USD -t JPY -d 2025-01-06

# Today's daily rates with cash rates
mufg-rates daily
mufg-rates daily 2025-03-15

# Monthly summary (month-end + average)
mufg-rates monthly 2025 1

# Yearly summary (year-end + average)
mufg-rates yearly 2024

# World rates (~73 countries vs USD)
mufg-rates world

# Reference rates (TWD, BRL, etc.)
mufg-rates reference 2024

# Yearly archive source workflow
mufg-rates download-source 2024 -o murc_2024.xls
mufg-rates parse-archive murc_2024.xls --json

# Machine-readable JSON output
mufg-rates rates 2025-01-06 --json
```

Output is human-readable tables by default. Use `--json` for compact JSON. Colors auto-disabled when piped.

## Tax-Related Source Context

This skill provides source-linked exchange-rate data. It is not affiliated with or endorsed by MUFG Bank, MURC, or the National Tax Agency, and it is not tax, accounting, legal, investment, trading, or settlement advice. Verify results against official sources and consult a qualified professional for specific filing decisions.

Relevant official sources:

- [NTA basic directive 57の3-2](https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/11a/01.htm)
- [NTA foreign-asset FAQ PDF](https://www.nta.go.jp/publication/pamph/hotei/kokugai_zaisan/pdf/kokugai_faq_h2_01.pdf)

Use this package to retrieve source-linked rate data, then verify which rate and date apply outside the package.

## Notes

- Source: MURC publishes MUFG Bank exchange quotations; each result includes source URLs for verification.
- TTM = (TTS + TTB) / 2
- MYR is always "unquoted" (null rates)
- KRW and IDR are quoted per 100 units
- Weekends/holidays auto-walk back to preceding business day (fetchRates, fetchDaily)
