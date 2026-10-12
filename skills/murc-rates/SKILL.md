---
name: murc-rates
description: Using murc-rates to fetch exchange-rate data published by MURC, including MUFG Bank TTS/TTB/TTM rates, JPY conversion, historical archives, monthly/yearly summaries, and world reference rates against USD.
---

# MURC Exchange Rates

Use murc-rates for exchange-rate data published by MURC (三菱UFJリサーチ＆コンサルティング), including MUFG Bank rates and extended reference data against JPY and USD.

## API

| Function | Description | Range |
| --- | --- | --- |
| `convertCurrency(options)` | Convert between JPY and one foreign currency using daily TTS/TTB/TTM | 1990+ |
| `fetchRates(date)` | Daily TTS/TTB/TTM for all currencies | 1990+ |
| `fetchDaily(date?)` | Daily TTS/TTB + cash selling/buying rates | 2005+ |
| `fetchMonthly(year, month)` | Month-end + monthly average + local market rates | 2005-09+ |
| `fetchYearly(year)` | Year-end + yearly average | 2003+ |
| `fetchWorld()` | World reference rates against USD | Latest month |
| `fetchReference(year)` | 8 additional currencies (TWD, BRL, etc.) | 2006+ |
| `getArchiveSourceUrl(year)` | Official yearly XLS URL | 1990+ |
| `downloadArchiveSource(year)` | Untouched yearly XLS bytes | 1990+ |
| `parseArchiveWorkbook(xlsBuffer)` | Parse a caller-provided yearly XLS workbook | 1990+ |

## Quick Start

```ts
import { fetchRates } from 'murc-rates';

const result = await fetchRates('2025-01-06');
if (result) {
  const usd = result.rates.USD;
  console.log(usd.ttm); // 104
}
```

## CLI

```bash
# Daily TTS/TTB/TTM for a specific date
murc-rates rates 2025-01-06
murc-rates rates 2025-01-06 --currency USD

# Convert between JPY and one foreign currency
murc-rates convert -a 100 -f USD -t JPY -d 2025-01-06

# Today's daily rates with cash rates
murc-rates daily
murc-rates daily 2025-03-15

# Monthly summary (month-end + average)
murc-rates monthly 2025 1

# Yearly summary (year-end + average)
murc-rates yearly 2024

# World reference rates against USD
murc-rates world

# Reference rates (TWD, BRL, etc.)
murc-rates reference 2024

# Yearly archive source workflow
murc-rates download-source 2024 -o murc_2024.xls
murc-rates parse-archive murc_2024.xls --json

# Machine-readable JSON output
murc-rates rates 2025-01-06 --json
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
